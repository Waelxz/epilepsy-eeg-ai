import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id?: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatContext {
  page?: string;
  patient_id?: string;
  analysis_id?: string;
  [key: string]: any;
}

export interface ChatRequest {
  message: string;
  context?: ChatContext;
  history?: Array<{role: string, content: string}>;
}

export interface ChatResponse {
  message: string;
  model: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiUrl}/chat`;
  private chatHistorySubject = new BehaviorSubject<ChatMessage[]>([]);
  
  // Stream of chat messages that components can subscribe to
  public chatHistory$ = this.chatHistorySubject.asObservable();
  
  // Context that gets sent with each message
  private currentContext: ChatContext = {};
  
  // Track if chat has been initialized to avoid duplicate welcome messages
  private isInitialized = false;

  constructor(private http: HttpClient) {
    // Try to load chat history from session storage on init
    this.loadChatHistoryFromStorage();
  }

  /**
   * Load chat history from session storage if available
   */
  private loadChatHistoryFromStorage(): void {
    try {
      const savedHistory = sessionStorage.getItem('chatHistory');
      // Load chat history if available
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        // Convert timestamps back to Date objects
        const processedHistory = parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        if (processedHistory && processedHistory.length > 0) {
          this.chatHistorySubject.next(processedHistory);
          this.isInitialized = true;
          console.log('Loaded chat history from session storage:', processedHistory.length, 'messages');
        }
      }
      
      // Don't load context from storage - we'll let the router update it
      // This ensures context is always current with the URL
      console.log('Context will be set from current URL instead of storage');
    } catch (e) {
      console.error('Error loading chat history from storage:', e);
    }
  }
  
  /**
   * Save chat history to session storage
   */
  private saveChatHistoryToStorage(): void {
    try {
      const currentHistory = this.chatHistorySubject.getValue();
      sessionStorage.setItem('chatHistory', JSON.stringify(currentHistory));
      sessionStorage.setItem('chatContext', JSON.stringify(this.currentContext));
    } catch (e) {
      console.error('Error saving chat history to storage:', e);
    }
  }

  /**
   * Send a message to the chat API
   * 
   * @param message - The user's message
   * @param context - The current application context (optional)
   */
  sendMessage(message: string, context: ChatContext = {}): Observable<ChatResponse> {
    // Merge with existing context
    const mergedContext = { ...this.currentContext, ...context };
    
    // Add user message to history
    const userMessage: ChatMessage = {
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    this.addMessageToHistory(userMessage);
    
    // Get the full history including the message we just added
    const currentHistory = this.chatHistorySubject.getValue();
    
    // Create API-formatted history from ALL messages
    const historyForApi = currentHistory.map((msg: ChatMessage) => {
      // Ensure we have valid messages for the API
      if (!msg.content || typeof msg.content !== 'string') {
        console.warn('Invalid message content detected, setting to empty string');
        msg.content = '';
      }
      
      // Convert from 'type' field to 'role' field expected by backend
      return {
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content.trim() // Trim whitespace to avoid issues
      };
    });
    
    // Filter out any empty messages that might cause issues
    const validHistoryForApi = historyForApi.filter(msg => 
      msg.content && msg.content.trim().length > 0 && 
      (msg.role === 'user' || msg.role === 'assistant')
    );
    
    // Log for debugging
    console.log('Sending conversation with', validHistoryForApi.length, 'messages');
    validHistoryForApi.forEach((msg: {role: string, content: string}, i: number) => {
      console.log(`Message ${i+1}: [${msg.role}] ${msg.content.substring(0, 30)}...`);
    });
    
    // Prepare request
    const request: ChatRequest = {
      message,
      context: mergedContext,
      history: validHistoryForApi
    };
    
    // Make API call
    return this.http.post<ChatResponse>(this.apiUrl, request);
  }
  
  /**
   * Update the current application context
   * 
   * @param context - The context to update or set
   */
  updateContext(context: ChatContext) {
    // Log context change for debugging
    console.log('ChatService: Context updated from', this.currentContext, 'to', context);
    
    // Replace the entire context rather than merging
    this.currentContext = { ...context };
    this.saveChatHistoryToStorage();
  }
  
  /**
   * Reset the context to empty
   */
  clearContext() {
    console.log('ChatService: Context cleared');
    this.currentContext = {};
    this.saveChatHistoryToStorage();
  }
  
  /**
   * Get the current context
   */
  getContext(): ChatContext {
    return { ...this.currentContext };
  }
  
  /**
   * Add a message to the chat history
   */
  addMessageToHistory(message: ChatMessage) {
    const currentHistory = this.chatHistorySubject.getValue();
    const newHistory = [...currentHistory, message];
    
    // Generate ID if not provided
    if (!message.id) {
      message.id = this.generateMessageId();
    }
    
    this.chatHistorySubject.next(newHistory);
    this.saveChatHistoryToStorage();
  }
  
  /**
   * Get the current chat history
   */
  getChatHistory(): ChatMessage[] {
    return this.chatHistorySubject.getValue();
  }
  
  /**
   * Clear the chat history
   */
  clearChatHistory() {
    this.chatHistorySubject.next([]);
    
    // Add a system message as the first message after clearing
    const welcomeMessage: ChatMessage = {
      type: 'assistant',
      content: 'Hello! I\'m your medical AI assistant. How can I help you with epilepsy or EEG analysis today?',
      timestamp: new Date()
    };
    this.addMessageToHistory(welcomeMessage);
    this.saveChatHistoryToStorage();
  }
  
  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return 'msg_' + Math.random().toString(36).substr(2, 9);
  }
} 