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
  Keyboard,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  GeminiMessage,
  sendMessageToGemini,
} from '../services/geminiService';
import { useTheme } from '../../app-kit/theme/useTheme';
import { analyticsManager } from '../../app-kit/analytics/AnalyticsManager';
import { LocalizationManager } from '../../app-kit/locales/LocalizationManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
  isError?: boolean;
  retryPrompt?: string;
}

interface ChatScreenProps {
  onBack: () => void;
  initialTopic?: string;
  starterPrompt?: string;
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

export default function ChatScreen({
  onBack,
  initialTopic,
  starterPrompt,
  messages,
  onUpdateMessages,
}: ChatScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLangVersion] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);
  const autoStartedKeyRef = useRef<string | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);

  messagesRef.current = messages;

  useEffect(() => {
    const unsubscribe = LocalizationManager.subscribe(() => {
      setLangVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, []);

  const commitMessages = (nextMessages: Message[]) => {
    messagesRef.current = nextMessages;
    onUpdateMessages(nextMessages);
  };

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
      return LocalizationManager.t('defaultWelcome');
    }
    return `**${topic}** — ${LocalizationManager.t('topicReadySuffix')}`;
  };

  const buildTopicInstruction = (topic?: string) => {
    const lang = LocalizationManager.getLanguage();
    const base = topic
      ? `Act as the dedicated ${topic} assistant. Keep every response relevant, accurate, practical, and tailored to the user's request.`
      : 'Act as a helpful, clear, and concise AI assistant.';
    return lang && lang !== 'en'
      ? `${base} Respond in language code "${lang}" when appropriate.`
      : base;
  };

  useEffect(() => {
    const sessionKey = `${initialTopic || 'default'}::${starterPrompt || ''}`;
    if (
      messagesRef.current.length > 0 ||
      !starterPrompt ||
      autoStartedKeyRef.current === sessionKey
    ) {
      return;
    }

    autoStartedKeyRef.current = sessionKey;

    const welcomeMsg: Message = {
      id: '1',
      role: 'model',
      text: getInitialWelcomeMessage(initialTopic),
      timestamp: getCurrentFormattedTime(),
    };
    commitMessages([welcomeMsg]);

    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setLoading(true);

    sendMessageToGemini([{ role: 'user', text: starterPrompt }], {
      systemInstruction: buildTopicInstruction(initialTopic),
      signal: controller.signal,
    })
      .then((aiResponseText) => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        const starterReply: Message = {
          id: `${Date.now()}_starter`,
          role: 'model',
          text: aiResponseText,
          timestamp: getCurrentFormattedTime(),
        };
        const current = messagesRef.current;
        const hasWelcome = current.some((m) => m.id === '1');
        commitMessages(
          hasWelcome ? [...current, starterReply] : [welcomeMsg, starterReply]
        );
      })
      .catch((error: any) => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        const errMsg: Message = {
          id: `${Date.now()}_starter_err`,
          role: 'model',
          text: `${LocalizationManager.t('aiServiceErrorPrefix')} (${
            error?.message || 'Network Error'
          })`,
          timestamp: getCurrentFormattedTime(),
          isError: true,
          retryPrompt: starterPrompt,
        };
        const current = messagesRef.current;
        const hasWelcome = current.some((m) => m.id === '1');
        commitMessages(
          hasWelcome ? [...current, errMsg] : [welcomeMsg, errMsg]
        );
      })
      .finally(() => {
        if (isMountedRef.current && activeControllerRef.current === controller) {
          activeControllerRef.current = null;
          setLoading(false);
        }
      });
  }, [initialTopic, starterPrompt]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 120);
    });

    return () => showSub.remove();
  }, []);

  const handleLongPressCopy = (text: string, isError?: boolean) => {
    if (isError || !text.trim()) return;
    Clipboard.setString(text);
    Alert.alert(
      LocalizationManager.t('copied'),
      LocalizationManager.t('messageCopied')
    );
    try {
      analyticsManager.logEvent('message_copied');
    } catch {}
  };

  const handleClearChat = () => {
    Alert.alert(
      LocalizationManager.t('clearChatTitle'),
      LocalizationManager.t('clearChatMessage'),
      [
        { text: LocalizationManager.t('cancel'), style: 'cancel' },
        {
          text: LocalizationManager.t('clear'),
          style: 'destructive',
          onPress: () => {
            activeControllerRef.current?.abort();
            activeControllerRef.current = null;
            setLoading(false);
            autoStartedKeyRef.current = null;
            const freshMsg: Message = {
              id: '1',
              role: 'model',
              text: getInitialWelcomeMessage(initialTopic),
              timestamp: getCurrentFormattedTime(),
            };
            commitMessages([freshMsg]);
            try {
              analyticsManager.logEvent('chat_cleared');
            } catch {}
          },
        },
      ]
    );
  };

  const executePrompt = async (
    promptText: string,
    baseMessages: Message[]
  ) => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) return;

    // Cancel any previous in-flight request so user messages always proceed immediately
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    const userMessage: Message = {
      id: `${Date.now()}_user`,
      role: 'user',
      text: trimmedPrompt,
      timestamp: getCurrentFormattedTime(),
    };

    const workingMessages = [...baseMessages, userMessage];
    commitMessages(workingMessages);
    setLoading(true);

    try {
      const history: GeminiMessage[] = workingMessages
        .filter((m) => m.id !== '1' && !m.isError && m.text.trim().length > 0)
        .map(({ role, text }) => ({ role, text: text.trim() }));

      const aiResponseText = await sendMessageToGemini(history, {
        systemInstruction: buildTopicInstruction(initialTopic),
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) return;

      const aiMessage: Message = {
        id: `${Date.now()}_ai`,
        role: 'model',
        text: aiResponseText,
        timestamp: getCurrentFormattedTime(),
      };

      commitMessages([...messagesRef.current, aiMessage]);
    } catch (error: any) {
      if (!isMountedRef.current || controller.signal.aborted) return;

      const errorMessage: Message = {
        id: `${Date.now()}_err`,
        role: 'model',
        text: `${LocalizationManager.t('aiServiceErrorPrefix')} (${
          error?.message || 'Network Error'
        })`,
        timestamp: getCurrentFormattedTime(),
        isError: true,
        retryPrompt: trimmedPrompt,
      };
      commitMessages([...messagesRef.current, errorMessage]);
    } finally {
      if (isMountedRef.current && activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend) return;
    setInputText('');
    await executePrompt(textToSend, messagesRef.current);
  };

  const handleRetry = async (failedMsg: Message) => {
    if (!failedMsg.retryPrompt) return;
    const current = messagesRef.current;
    const previousUserMessage = [...current]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' && message.text === failedMsg.retryPrompt
      );
    const filtered = current.filter(
      (message) =>
        message.id !== failedMsg.id && message.id !== previousUserMessage?.id
    );
    await executePrompt(failedMsg.retryPrompt, filtered);
  };

  const markdownStyles = {
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    code_inline: {
      backgroundColor: colors.background,
      color: colors.primary,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 5,
    },
    fence: {
      backgroundColor: colors.background,
      color: colors.text,
      padding: 10,
      borderRadius: 10,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View style={styles.messageRowContainer}>
        {item.timestamp && (
          <Text style={[styles.timestampText, { color: colors.textMuted }]}>
            {item.timestamp}
          </Text>
        )}
        <View
          style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
        >
          {!isUser && (
            <View
              style={[
                styles.aiAvatar,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={styles.avatarEmoji}>🤖</Text>
            </View>
          )}
          <View style={styles.bubbleColumn}>
            <TouchableOpacity
              activeOpacity={0.85}
              delayLongPress={280}
              onLongPress={() => handleLongPressCopy(item.text, item.isError)}
              style={[
                styles.messageBubble,
                isUser
                  ? { backgroundColor: colors.primary }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: item.isError ? '#EF4444' : colors.border,
                      borderWidth: 1,
                    },
                isUser ? styles.userBubble : styles.aiBubble,
              ]}
            >
              {isUser ? (
                <Text style={styles.userText}>{item.text}</Text>
              ) : (
                <Markdown style={markdownStyles}>{item.text}</Markdown>
              )}
            </TouchableOpacity>

            {item.isError && item.retryPrompt && (
              <View style={styles.retryRow}>
                <TouchableOpacity
                  onPress={() => handleRetry(item)}
                  style={[styles.retryChip, { backgroundColor: colors.primary }]}
                  activeOpacity={0.75}
                >
                  <Text style={styles.retryChipText}>
                    ↻ {LocalizationManager.t('retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {initialTopic || LocalizationManager.t('appTitle')}
        </Text>
        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.clearButton}
          activeOpacity={0.7}
        >
          <Text style={styles.clearButtonEmoji}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
        style={styles.chatContainer}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              {LocalizationManager.t('aiThinking')}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder={LocalizationManager.t('askAnyQuestion')}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    height: 60,
  },
  backButton: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 14,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: -5,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  clearButton: {
    height: 38,
    width: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonEmoji: { fontSize: 18 },
  chatContainer: { flex: 1 },
  listContainer: { padding: 16, paddingBottom: 20 },
  messageRowContainer: { marginBottom: 16 },
  timestampText: { textAlign: 'center', fontSize: 11, marginBottom: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  avatarEmoji: { fontSize: 18 },
  bubbleColumn: { maxWidth: '80%' },
  messageBubble: { padding: 14, borderRadius: 16 },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  retryRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 6 },
  retryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  retryChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  loadingText: { marginLeft: 8, fontSize: 13, fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 120,
    fontSize: 15,
    borderWidth: 1,
  },
  sendButton: {
    marginLeft: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#FFFFFF', fontSize: 16 },
});