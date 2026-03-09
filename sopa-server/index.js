const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = 3000;

// Utilidades del juego
const WORDS_POOL = [
  "CASA", "PERRO", "GATO", "MESA", "SILLA", "RELOJ", "CARRO", "MUNDO",
  "CIELO", "ARBOL", "HOJA", "AGUA", "FUEGO", "MAR", "SOL", "LUNA", "ESTRELLA"
];

function generateBoard() {
  const size = 10;
  const board = Array.from({ length: size }, () => Array(size).fill(''));
  const words = [];

  // Seleccionar 8 palabras al azar
  const shuffledPool = [...WORDS_POOL].sort(() => 0.5 - Math.random());
  const selectedWords = shuffledPool.slice(0, 8);

  // Intentar acomodar palabras (horizontal y vertical)
  selectedWords.forEach(word => {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      attempts++;
      const isHorizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      if (isHorizontal) {
        if (col + word.length <= size) {
          let canPlace = true;
          // Esta
          for (let i = 0; i < word.length; i++) {
            if (board[row][col + i] !== '' && board[row][col + i] !== word[i]) {
              canPlace = false; break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < word.length; i++) {
              board[row][col + i] = word[i];
            }
            placed = true;
            words.push({ word, pos: { r: row, c: col, dir: 'H' } });
          }
        }
      } else {
        if (row + word.length <= size) {
          let canPlace = true;
          for (let i = 0; i < word.length; i++) {
            if (board[row + i][col] !== '' && board[row + i][col] !== word[i]) {
              canPlace = false; break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < word.length; i++) {
              board[row + i][col] = word[i];
            }
            placed = true;
            words.push({ word, pos: { r: row, c: col, dir: 'V' } });
          }
        }
      }
    }
  });

  // Rellenar espacios vacios
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === '') {
        board[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }

  return { board, wordsToFind: words.map(w => w.word) };
}

// Estructura para guardar estado de las salas
// rooms[pin] = { board, wordsToFind, players: [{id, name, score, role}], turnIndex, timerId, timeLeft, activeWords }
const rooms = {};

// Helper para crear PIN random
function generatePin() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Un usuario conectado:', socket.id);

  socket.on('createRoom', ({ nickname }) => {
    const pin = generatePin();
    const gameData = generateBoard();

    rooms[pin] = {
      pin,
      board: gameData.board,
      wordsToFind: gameData.wordsToFind,
      foundWords: [], // Guardar { word, byPlayerId }
      players: [
        { id: socket.id, name: nickname, score: 0, role: 'host' }
      ],
      turnIndex: 0, // 0 para el host, 1 para el guest
      timeLeft: 30,
      
      timerId: null,
      status: 'waiting' // waiting, playing, finished
    };

    socket.join(pin);
    socket.emit('roomCreated', { pin });
    console.log(`Sala creada: ${pin} por ${nickname}`);
  });

  socket.on('joinRoom', ({ pin, nickname }) => {
    const room = rooms[pin];
    if (room && room.players.length < 2 && room.status === 'waiting') {
      room.players.push({ id: socket.id, name: nickname, score: 0, role: 'guest' });
      socket.join(pin);

      room.status = 'playing';
      io.to(pin).emit('gameStarted', {
        players: room.players,
        board: room.board,
        wordsToFind: room.wordsToFind,
        turnIndex: room.turnIndex,
      });

      startTurnTimer(pin);
      console.log(`${nickname} se unió a la sala ${pin}`);
    } else {
      socket.emit('errorMsg', 'Sala no encontrada o llena.');
    }
  });

  socket.on('submitWord', ({ pin, startCoords, endCoords, selectedWord }) => {
    const room = rooms[pin];
    if (!room || room.status !== 'playing') return;

    // Verificar si es el turno del jugador que envió
    const currentPlayer = room.players[room.turnIndex];
    if (socket.id !== currentPlayer.id) return;

    // Validar si la palabra está al derecho o al revés
    const reversedWord = selectedWord.split('').reverse().join('');
    let validWord = null;

    if (room.wordsToFind.includes(selectedWord)) {
      validWord = selectedWord;
    } else if (room.wordsToFind.includes(reversedWord)) {
      validWord = reversedWord;
    }

    const notFoundYet = validWord && !room.foundWords.some(fw => fw.word === validWord);

    if (validWord && notFoundYet) {
      room.foundWords.push({ word: validWord, byPlayerId: socket.id });
      currentPlayer.score += 1;

      io.to(pin).emit('wordFound', {
        word: validWord,
        startCoords,
        endCoords,
        players: room.players,
        foundWords: room.foundWords
      });

      // Chequear condición de victoria/fin
      if (room.foundWords.length === room.wordsToFind.length) {
        endGame(pin);
        return;
      }
    }

    // Cambiar de turno
    changeTurn(pin);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    // Manejar desconexión (avisar al otro jugador y cerrar sala si era un jugador activo)
    for (const pin in rooms) {
      const room = rooms[pin];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        clearInterval(room.timerId);
        io.to(pin).emit('playerDisconnected', 'El otro jugador se ha desconectado. El juego terminó.');
        delete rooms[pin];
        break;
      }
    }
  });
});

function startTurnTimer(pin) {
  const room = rooms[pin];
  if (!room) return;

  clearInterval(room.timerId);
  room.timeLeft = 30;

  io.to(pin).emit('timerUpdate', room.timeLeft);

  room.timerId = setInterval(() => {
    room.timeLeft -= 1;
    io.to(pin).emit('timerUpdate', room.timeLeft);

    if (room.timeLeft <= 0) {
      changeTurn(pin);
    }
  }, 1000);
}

function changeTurn(pin) {
  const room = rooms[pin];
  if (!room || room.status !== 'playing') return;

  room.turnIndex = room.turnIndex === 0 ? 1 : 0;
  io.to(pin).emit('turnChanged', { turnIndex: room.turnIndex });
  startTurnTimer(pin);
}

function endGame(pin) {
  const room = rooms[pin];
  if (!room) return;

  clearInterval(room.timerId);
  room.status = 'finished';

  // Determinar ganador
  let winner = null;
  const p1 = room.players[0];
  const p2 = room.players[1];

  if (p1.score > p2.score) winner = p1;
  else if (p2.score > p1.score) winner = p2;
  // si es empate, winner es null

  io.to(pin).emit('gameOver', {
    winner,
    players: room.players
  });

  // Limpiar sala después de un rato o inmediatamente
  setTimeout(() => {
    delete rooms[pin];
  }, 10000); // 10s después
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Sopa de Letras corriendo en puerto ${PORT}`);
});
