import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../../shared/services/chat.service';
import { Subscription } from 'rxjs';
import { FormatChatMessagePipe } from '../../../shared/pipes/format-chat-message.pipe';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatChatMessagePipe],
  templateUrl: './chat-page.component.html',
  styleUrls: ['./chat-page.component.css']
})
export class ChatPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  messages: ChatMessage[] = [];
  newMessage = '';
  isLoading = false;
  errorMessage = '';
  
  // ViewChild for scrolling to bottom of chat
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  
  // Track if we should scroll to bottom
  private shouldScrollToBottom = true;
  
  // Subscriptions to clean up
  private chatSubscription: Subscription | null = null;
  
  constructor(private chatService: ChatService) {}
  
  ngOnInit(): void {
    // Subscribe to chat history updates
    this.chatSubscription = this.chatService.chatHistory$.subscribe(history => {
      this.messages = history;
      this.shouldScrollToBottom = true;
      
      // Log the current history state for debugging
      console.log(`Chat history updated - ${this.messages.length} messages`);
      if (this.messages.length > 0) {
        console.log(`Latest message: [${this.messages[this.messages.length-1].type}] ${this.messages[this.messages.length-1].content.substring(0, 30)}...`);
      } else {
        console.log('Chat history is empty');
      }
    });
    
    // Get current history to check if we need to add welcome message
    const currentHistory = this.chatService.getChatHistory();
    
    // Add welcome message if no messages
    if (!currentHistory || currentHistory.length === 0) {
      console.log('Adding welcome message to empty chat');
      const welcomeMessage: ChatMessage = {
        type: 'assistant',
        content: 'Hello! I\'m your medical AI assistant. How can I help you with epilepsy or EEG analysis today?',
        timestamp: new Date()
      };
      this.chatService.addMessageToHistory(welcomeMessage);
    }
    
    // Update chat context to reflect we're on the dedicated chat page
    // Preserve any existing patient or analysis context
    const currentContext = this.chatService.getContext();
    this.chatService.updateContext({ 
      ...currentContext,
      page: 'chat-page' 
    });
  }
  
  ngOnDestroy(): void {
    // Clean up subscription
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
  }
  
  ngAfterViewChecked() {
    // Scroll to bottom after view is checked if needed
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }
  
  sendMessage(): void {
    if (!this.newMessage.trim() || this.isLoading) return;
    
    const message = this.newMessage.trim();
    this.newMessage = ''; // Clear input field
    this.isLoading = true;
    this.errorMessage = '';
    
    // Send message to backend
    this.chatService.sendMessage(message).subscribe({
      next: (response) => {
        // Add assistant response to chat
        const assistantMessage: ChatMessage = {
          type: 'assistant',
          content: response.message,
          timestamp: new Date()
        };
        this.chatService.addMessageToHistory(assistantMessage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error sending message:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to get response. Please try again.';
        
        // Add error message to chat
        const errorAssistantMessage: ChatMessage = {
          type: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date()
        };
        this.chatService.addMessageToHistory(errorAssistantMessage);
      }
    });
  }
  
  clearChat(): void {
    this.chatService.clearChatHistory();
    
    // Add welcome message after clearing
    const welcomeMessage: ChatMessage = {
      type: 'assistant',
      content: 'Chat history cleared. How can I help you?',
      timestamp: new Date()
    };
    this.chatService.addMessageToHistory(welcomeMessage);
  }
  
  private scrollToBottom(): void {
    try {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
  
  getMessageTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  getCurrentTime(): string {
    return new Date().toLocaleString();
  }
} 