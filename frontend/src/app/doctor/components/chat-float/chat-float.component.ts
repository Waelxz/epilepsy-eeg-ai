import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { ChatService, ChatMessage, ChatContext } from '../../../shared/services/chat.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FormatChatMessagePipe } from '../../../shared/pipes/format-chat-message.pipe';

@Component({
  selector: 'app-chat-float',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatChatMessagePipe],
  templateUrl: './chat-float.component.html',
  styleUrls: ['./chat-float.component.css']
})
export class ChatFloatComponent implements OnInit, OnDestroy {
  isOpen = false;
  messages: ChatMessage[] = [];
  newMessage = '';
  isLoading = false;
  errorMessage = '';
  
  // Subscriptions to clean up on destroy
  private chatSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;
  
  constructor(
    private chatService: ChatService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Subscribe to chat history updates
    this.chatSubscription = this.chatService.chatHistory$.subscribe(history => {
      this.messages = history;
    });
    
    // Monitor route changes to update context
    this.routeSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Parse the current route to determine context
      const url = event.url;
      console.log('Navigation detected to:', url);
      // Force context update on every route change
      this.updateContextFromUrl(url);
      // Clear any existing context that might be outdated
      const context = this.chatService.getContext();
      console.log('Updated context after navigation:', context);
    });
    
    // Set initial context based on current URL
    this.updateContextFromUrl(this.router.url);
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
  
  toggleChat(): void {
    this.isOpen = !this.isOpen;
    
    // If opening the chat and no messages, show a welcome message
    if (this.isOpen && this.messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        type: 'assistant',
        content: 'Hello! I\'m your medical AI assistant. How can I help you with epilepsy or EEG analysis today?',
        timestamp: new Date()
      };
      this.chatService.addMessageToHistory(welcomeMessage);
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
  }
  
  private updateContextFromUrl(url: string): void {
    // Get current context to preserve certain values
    const currentContext = this.chatService.getContext();
    
    // Create new context starting with page info
    const newContext: ChatContext = { 
      page: this.getPageName(url) 
    };
    
    // Extract patient ID if present in URL
    const patientMatch = url.match(/\/patients\/([^\/]+)/);
    if (patientMatch && patientMatch[1]) {
      newContext.patient_id = patientMatch[1];
    } else {
      // Clear patient_id if not in URL
      newContext.patient_id = undefined;
    }
    
    // Extract analysis ID if present in URL
    const analysisMatch = url.match(/\/analysis\/([^\/]+)/);
    if (analysisMatch && analysisMatch[1]) {
      newContext.analysis_id = analysisMatch[1];
    } else {
      // Clear analysis_id if not in URL
      newContext.analysis_id = undefined;
    }
    
    // Update context in service (completely replacing it)
    this.chatService.clearContext(); // Clear first to ensure clean state
    this.chatService.updateContext(newContext);
    
    // Log context changes for debugging
    console.log('Chat context completely refreshed:', newContext);
  }
  
  private getPageName(url: string): string {
    const parts = url.split('/').filter(p => p);
    
    if (parts.length === 0) return 'home';
    
    // Extract second path component when doctor is the first
    if (parts[0] === 'doctor' && parts.length > 1) {
      const section = parts[1].split('?')[0]; // Remove any query params
      
      switch (section) {
        case 'dashboard': return 'dashboard';
        case 'patients': return parts.length > 2 ? 'patient details' : 'patients list';
        case 'analysis': return 'analysis details';
        case 'analysis-history': return 'analysis history';
        case 'new-analysis': return 'new analysis';
        case 'reports': return 'reports';
        default: return section;
      }
    }
    
    return parts[0];
  }
} 