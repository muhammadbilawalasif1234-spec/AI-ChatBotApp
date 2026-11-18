// src/app/screens/ChatScreen.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  GeminiMessage,
  sendMessageToGemini,
} from '../services/geminiService';
import { useTheme } from '../../app-kit/theme/useTheme';
import { AnalyticsManager } from '../../app-kit/analytics/AnalyticsManager';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

interface ChatScreenProps {
  onBack: () => void;
  initialTopic?: string;
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

export default function ChatScreen({ onBack, initialTopic, messages, onUpdateMessages }: ChatScreenProps) {
  const { colors } = useTheme();

  const getCurrentFormattedTime = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return now.toLocaleString('en-US', options);
  };

  const getInitialWelcomeMessage = (topic?: string) => {
    if (!topic) {
      return "Welcome! I'm ready to provide instant answers to your questions.";
    }
    return `Welcome! Let's explore **${topic}** together. How can I assist you today?`;
  };

  // Initialize welcome message if session is empty
  useEffect(() => {
    if (messages.length === 0) {
      const initialMsg: Message = {
        id: '1',
        role: 'model',
        text: getInitialWelcomeMessage(initialTopic),
        timestamp: getCurrentFormattedTime(),
      };
      onUpdateMessages([initialMsg]);
    }
  }, [initialTopic]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleCopyText = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Success', 'Message copied to clipboard!');
    try {
      AnalyticsManager.logEvent('message_copied');
    } catch (e) {}
  };

  // Professional Clear Chat Handler with Confirmation Alert
  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to delete all chat history for this topic?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const freshMsg: Message = {
              id: Date.now().toString(),
              role: 'model',
              text: getInitialWelcomeMessage(initialTopic),
              timestamp: getCurrentFormattedTime(),
            };
            onUpdateMessages([freshMsg]);
            try {
              AnalyticsManager.logEvent('chat_cleared');
            } catch (e) {}
          },
        },
      ]
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMsgText = inputText.trim();
    setInputText('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userMsgText,
      timestamp: getCurrentFormattedTime(),
    };

    const updatedWithUser = [...messages, userMessage];
    onUpdateMessages(updatedWithUser);
    setLoading(true);

    try {
      const conversation: GeminiMessage[] = [
        ...updatedWithUser
          .slice(1)
          .map(({ role, text }) => ({ role, text })),
      ];

      const aiResponseText = await sendMessageToGemini(conversation);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText,
        timestamp: getCurrentFormattedTime(),
      };

      onUpdateMessages([...updatedWithUser, aiMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Unable to reach AI service. Please check your API Key and internet connection. (${error?.message || 'Network Error'})`,
        timestamp: getCurrentFormattedTime(),
      };
      onUpdateMessages([...updatedWithUser, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const markdownStyles = {
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    code_inline: { backgroundColor: colors.surface, color: colors.primary, padding: 4, borderRadius: 4 },
    fence: { backgroundColor: colors.surface, color: colors.text, padding: 10, borderRadius: 8, marginVertical: 6, borderWidth: 1, borderColor: colors.border },
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={styles.messageRowContainer}>
        {item.timestamp && (
          <Text style={[styles.timestampText, { color: colors.textMuted }]}>{item.timestamp}</Text>
        )}
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
          {!isUser && (
            <View style={[styles.aiAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.avatarEmoji}>🤖</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              isUser ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {isUser ? (
              <Text style={styles.userText}>{item.text}</Text>
            ) : (
              <Markdown style={markdownStyles}>{item.text}</Markdown>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button, Title, and Clear Chat Button */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {initialTopic ? initialTopic : 'AI Chat Assistant'}
        </Text>
        <TouchableOpacity onPress={handleClearChat} style={styles.clearButton} activeOpacity={0.7}>
          <Text style={styles.clearButtonEmoji}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>AI is thinking...</Text>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Ask any question..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }, !inputText.trim() || loading ? styles.sendButtonDisabled : null]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, height: 60 },
  backButton: { height: 38, justifyContent: 'center', alignItems: 'center', paddingRight: 14 },
  backArrow: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: -5 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  clearButton: { height: 38, width: 38, justifyContent: 'center', alignItems: 'center' },
  clearButtonEmoji: { fontSize: 18 },
  chatContainer: { flex: 1 },
  listContainer: { padding: 16, paddingBottom: 20 },
  messageRowContainer: { marginBottom: 16 },
  timestampText: { textAlign: 'center', fontSize: 11, marginBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1 },
  avatarEmoji: { fontSize: 18 },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 16 },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  loadingText: { marginLeft: 8, fontSize: 13, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', padding: 14, alignItems: 'center', borderTopWidth: 1 },
  textInput: { flex: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, maxHeight: 120, fontSize: 15, borderWidth: 1 },
  sendButton: { marginLeft: 10, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#FFFFFF', fontSize: 16 },
});