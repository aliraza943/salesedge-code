import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, TextInput, KeyboardAvoidingView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { login, signup } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !name)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Login] Auth failed:', error);
      Alert.alert('Authentication Failed', error instanceof Error ? error.message : 'Unknown error occurred');
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.card}>
            <View style={styles.logoContainer}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: 80, height: 80, borderRadius: 16 }}
                contentFit="contain"
              />
            </View>
            
            <Text style={[styles.title, { color: colors.foreground }]}>SalesEdge</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </Text>

            <View style={styles.form}>
              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.muted }]}>Full Name</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="John Doe"
                    placeholderTextColor={colors.muted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.muted }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="john@example.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.muted }]}>Password</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.primary }]} 
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.switchButton} 
                onPress={() => setIsSignUp(!isSignUp)}
                disabled={loading}
              >
                <Text style={[styles.switchText, { color: colors.muted }]}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    paddingVertical: 32,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
  },
});
