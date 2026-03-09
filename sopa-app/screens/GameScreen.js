import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import socketService from '../socket';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 10;

export default function GameScreen({ route, navigation }) {
    const { pin, nickname, gameData } = route.params;
    const [board, setBoard] = useState(gameData.board);
    const [wordsToFind, setWordsToFind] = useState(gameData.wordsToFind);
    const [players, setPlayers] = useState(gameData.players);
    const [turnIndex, setTurnIndex] = useState(gameData.turnIndex);

    const [timeLeft, setTimeLeft] = useState(30);
    const [selection, setSelection] = useState({ start: null, end: null });
    const [foundWords, setFoundWords] = useState(gameData.foundWords || []);
    const [foundLines, setFoundLines] = useState([]);

    const me = players.find(p => p.name === nickname);
    const isMyTurn = players[turnIndex]?.name === nickname;

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;

        socket.on('timerUpdate', (time) => setTimeLeft(time));

        socket.on('turnChanged', ({ turnIndex }) => {
            setTurnIndex(turnIndex);
            setSelection({ start: null, end: null });
        });

        socket.on('wordFound', ({ word, startCoords, endCoords, players: updatedPlayers, foundWords: newFoundWords }) => {
            setPlayers(updatedPlayers);
            setFoundWords(newFoundWords);
            const playerColor = newFoundWords.find(fw => fw.word === word)?.byPlayerId === me?.id ? '#4CAF50' : '#2196F3';
            setFoundLines(prev => [...prev, { startCoords, endCoords, color: playerColor }]);
        });

        socket.on('gameOver', ({ winner, players }) => {
            setPlayers(players);
            let msg = winner ? (winner.id === me?.id ? "¡Ganaste!" : "¡Perdiste!") : "Empate";
            Alert.alert("Fin del Juego", msg, [{ text: "Volver a Inicio", onPress: () => navigation.navigate('Home') }]);
        });

        socket.on('playerDisconnected', (msg) => {
            Alert.alert("Desconexión", msg, [{ text: "OK", onPress: () => navigation.navigate('Home') }]);
        });

        return () => {
            socket.off('timerUpdate');
            socket.off('turnChanged');
            socket.off('wordFound');
            socket.off('gameOver');
            socket.off('playerDisconnected');
        };
    }, []);

    const handleCellPress = (r, c) => {
        if (!isMyTurn) return;

        if (!selection.start) {
            setSelection({ start: { r, c }, end: null });
        } else {
            const end = { r, c };
            const dr = end.r - selection.start.r;
            const dc = end.c - selection.start.c;

            const isHorizontal = dr === 0;
            const isVertical = dc === 0;
            const isDiagonal = Math.abs(dr) === Math.abs(dc);

            if (isHorizontal || isVertical || isDiagonal) {
                let selectedWord = "";
                let steps = Math.max(Math.abs(dr), Math.abs(dc));
                let stepR = dr === 0 ? 0 : dr / steps;
                let stepC = dc === 0 ? 0 : dc / steps;

                for (let i = 0; i <= steps; i++) {
                    selectedWord += board[selection.start.r + i * stepR][selection.start.c + i * stepC];
                }

                const socket = socketService.getSocket();
                socket.emit('submitWord', { pin, startCoords: selection.start, endCoords: end, selectedWord });
            } else {
                Alert.alert("Inválido", "La selección debe ser en línea recta.");
            }

            setSelection({ start: null, end: null });
        }
    };

    const isCellInSelection = (r, c) => {
        if (selection.start && selection.start.r === r && selection.start.c === c) return true;
        return false;
    };

    const isCellInFoundWord = (r, c) => {
        for (let line of foundLines) {
            const { startCoords, endCoords } = line;
            const dr = endCoords.r - startCoords.r;
            const dc = endCoords.c - startCoords.c;
            let steps = Math.max(Math.abs(dr), Math.abs(dc));
            let stepR = dr === 0 ? 0 : dr / steps;
            let stepC = dc === 0 ? 0 : dc / steps;

            for (let i = 0; i <= steps; i++) {
                if (startCoords.r + i * stepR === r && startCoords.c + i * stepC === c) {
                    return line.color;
                }
            }
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pinText}>Sala: {pin}</Text>
                <Text style={[styles.timer, timeLeft <= 5 && styles.timerDanger]}>00:{timeLeft.toString().padStart(2, '0')}</Text>
            </View>

            <View style={styles.playersCard}>
                {players.map((p, idx) => (
                    <View key={p.id} style={[styles.playerObj, turnIndex === idx && styles.activePlayer]}>
                        <Text style={styles.playerName}>{p.name} {p.id === me?.id ? "(Tú)" : ""}</Text>
                        <Text style={styles.playerScore}>{p.score} pts</Text>
                    </View>
                ))}
            </View>

            <View style={styles.turnIndicator}>
                <Text style={[styles.turnText, { color: isMyTurn ? '#4CAF50' : '#F44336' }]}>
                    {isMyTurn ? "¡Es tu turno!" : `Turno de ${players[turnIndex]?.name}`}
                </Text>
            </View>

            <Text style={styles.hintText}>Toca la 1ª letra y luego la última letra de la palabra.</Text>

            <View style={styles.boardContainer}>
                {board.map((row, r) => (
                    <View key={`row-${r}`} style={styles.row}>
                        {row.map((cell, c) => {
                            const foundColor = isCellInFoundWord(r, c);
                            const isSelected = isCellInSelection(r, c);

                            let backgroundColor = '#fff';
                            let textColor = '#333';

                            if (foundColor) {
                                backgroundColor = foundColor;
                                textColor = '#fff';
                            } else if (isSelected) {
                                backgroundColor = '#FFEB3B';
                            }

                            return (
                                <TouchableOpacity
                                    key={`cell-${r}-${c}`}
                                    style={[styles.cell, { backgroundColor }]}
                                    onPress={() => handleCellPress(r, c)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.cellText, { color: textColor }]}>{cell}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>

            <View style={styles.wordsList}>
                <Text style={styles.wordsTitle}>Faltan:</Text>
                <View style={styles.wordsContainer}>
                    {wordsToFind.map(word => {
                        const isFound = foundWords.some(fw => fw.word === word);
                        return (
                            <Text key={word} style={[styles.wordItem, isFound && styles.wordItemFound]}>
                                {word}
                            </Text>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#E8F5E9', padding: 20, paddingTop: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    pinText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
    timer: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    timerDanger: { color: '#F44336' },
    playersCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white', padding: 10, borderRadius: 10, elevation: 2, marginBottom: 10 },
    playerObj: { flex: 1, alignItems: 'center', padding: 5, borderRadius: 8 },
    activePlayer: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#2196F3' },
    playerName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    playerScore: { fontSize: 16, fontWeight: '900', color: '#2E7D32' },
    turnIndicator: { alignItems: 'center', marginBottom: 5 },
    turnText: { fontSize: 18, fontWeight: 'bold' },
    hintText: { fontSize: 11, textAlign: 'center', color: '#888', marginBottom: 15 },
    boardContainer: { backgroundColor: 'white', padding: 5, borderRadius: 10, elevation: 3, alignItems: 'center' },
    row: { flexDirection: 'row' },
    cell: { width: CELL_SIZE, height: CELL_SIZE, borderWidth: 0.5, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    cellText: { fontSize: 18, fontWeight: 'bold' },
    wordsList: { flex: 1, marginTop: 15, backgroundColor: 'white', borderRadius: 10, padding: 15, elevation: 2 },
    wordsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
    wordsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    wordItem: { fontSize: 14, fontWeight: '600', color: '#555', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    wordItemFound: { textDecorationLine: 'line-through', color: '#AAA', backgroundColor: '#EEE' }
});
