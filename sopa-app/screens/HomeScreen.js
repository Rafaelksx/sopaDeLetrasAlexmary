import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import socketService from '../socket';

export default function HomeScreen({ navigation }) {
    const [ipAddress, setIpAddress] = useState('192.168.');
    const [nickname, setNickname] = useState('');
    const [pinToJoin, setPinToJoin] = useState('');

    const handleConnect = () => {
        if (!nickname.trim() || !ipAddress.trim() || ipAddress.endsWith('.')) {
            Alert.alert("Revisar", "Debes ingresar tu Apodo y la IP completa del Servidor.");
            return null;
        }
        return socketService.connect(ipAddress);
    };

    const createRoom = () => {
        const socket = handleConnect();
        if (!socket) return;

        socket.emit('createRoom', { nickname });

        socket.once('roomCreated', ({ pin }) => {
            navigation.navigate('Lobby', { pin, nickname, isHost: true });
        });
    };

    const joinRoom = () => {
        if (!pinToJoin.trim()) {
            Alert.alert("Revisar", "Debes ingresar el PIN de la sala de tu amigo.");
            return;
        }
        const socket = handleConnect();
        if (!socket) return;

        socket.emit('joinRoom', { pin: pinToJoin.toUpperCase(), nickname });

        socket.once('errorMsg', (msg) => {
            Alert.alert("Error", msg);
            socketService.disconnect();
        });

        socket.once('gameStarted', (gameData) => {
            navigation.navigate('Game', { gameData, pin: pinToJoin.toUpperCase(), nickname });
        });
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.card}>
                <Text style={styles.title}>Sopa de Letras</Text>
                <Text style={styles.subtitle}>Multijugador Offline</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>IP Local del Servidor:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. 192.168.1.15"
                        value={ipAddress}
                        onChangeText={setIpAddress}
                        keyboardType="numeric"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Tu Apodo:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Jugador1"
                        value={nickname}
                        onChangeText={setNickname}
                        maxLength={10}
                    />
                </View>

                <TouchableOpacity style={styles.buttonCreate} onPress={createRoom}>
                    <Text style={styles.btnText}>CREAR SALA NUEVA</Text>
                </TouchableOpacity>

                <View style={styles.separatorContainer}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>o únete a una</Text>
                    <View style={styles.line} />
                </View>

                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, styles.inputHalf]}
                        placeholder="PIN"
                        value={pinToJoin}
                        onChangeText={setPinToJoin}
                        autoCapitalize="characters"
                        maxLength={6}
                    />
                    <TouchableOpacity style={[styles.buttonJoin, styles.buttonHalf]} onPress={joinRoom}>
                        <Text style={styles.btnTextJoin}>UNIRSE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', backgroundColor: '#E8F5E9', padding: 20 },
    card: { backgroundColor: 'white', padding: 25, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    title: { fontSize: 32, fontWeight: '900', textAlign: 'center', color: '#2E7D32', marginBottom: 2 },
    subtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 30, fontStyle: 'italic' },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 14, color: '#333', marginBottom: 5, fontWeight: '600' },
    input: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 16, color: '#333' },
    buttonCreate: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 2 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
    separatorContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
    line: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
    orText: { width: 100, textAlign: 'center', color: '#999', fontSize: 12, textTransform: 'uppercase' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    inputHalf: { flex: 0.45, marginBottom: 0, textAlign: 'center', fontWeight: 'bold' },
    buttonJoin: { flex: 0.5, backgroundColor: '#2196F3', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    btnTextJoin: { color: 'white', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }
});
