import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import socketService from '../socket';

export default function LobbyScreen({ route, navigation }) {
    const { pin, nickname, isHost } = route.params;

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;

        socket.on('gameStarted', (gameData) => {
            // Reemplazamos la pantalla actual por la del juego para evitar volver al lobby con el botón "Atrás"
            navigation.replace('Game', { gameData, pin, nickname });
        });

        socket.on('playerDisconnected', (msg) => {
            Alert.alert("Desconexión", msg);
            navigation.navigate('Home');
        });

        return () => {
            socket.off('gameStarted');
            socket.off('playerDisconnected');
        };
    }, []);

    const cancelRoom = () => {
        socketService.disconnect();
        navigation.navigate('Home');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sala de Espera</Text>

            <View style={styles.card}>
                <Text style={styles.subtitle}>Tu PIN de Sala es:</Text>
                <Text style={styles.pin}>{pin}</Text>
                <Text style={styles.instruction}>Comparte este PIN con tu compañero para que se una a la partida.</Text>
            </View>

            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
            <Text style={styles.waitingText}>Esperando al jugador 2...</Text>

            <TouchableOpacity style={styles.cancelBtn} onPress={cancelRoom}>
                <Text style={styles.cancelBtnText}>CANCELAR Y SALIR</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#E8F5E9', padding: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#2E7D32', marginBottom: 30 },
    card: { backgroundColor: 'white', padding: 30, borderRadius: 15, alignItems: 'center', elevation: 5, width: '100%', marginBottom: 40 },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 10 },
    pin: { fontSize: 48, fontWeight: '900', color: '#333', letterSpacing: 5 },
    instruction: { textAlign: 'center', color: '#888', marginTop: 15, fontSize: 13 },
    loader: { marginBottom: 15 },
    waitingText: { fontSize: 16, color: '#4CAF50', fontWeight: '600' },
    cancelBtn: { marginTop: 40, padding: 15 },
    cancelBtnText: { color: '#F44336', fontWeight: 'bold', letterSpacing: 1 }
});
