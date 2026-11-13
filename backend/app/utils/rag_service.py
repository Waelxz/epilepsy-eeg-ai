import os
import logging
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from dotenv import load_dotenv

# Configure logger
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class RAGService:
    """
    Service to handle Retrieval-Augmented Generation (RAG) for the chatbot
    """
    
    def __init__(self, pdf_folder=None):
        """Initialize the RAG service"""
        if pdf_folder is None:
            # Default to the rag folder in the Backend directory
            current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            pdf_folder = os.path.join(current_dir, 'rag')
        
        self.pdf_folder = pdf_folder
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vector_store = None
        self.is_initialized = False
    
    def initialize(self, force_reload=False):
        """
        Initialize the RAG service by loading and indexing documents
        
        Args:
            force_reload: If True, reload all documents even if already loaded
        
        Returns:
            bool: Success status
        """
        try:
            # Check if already initialized and no force reload
            if self.is_initialized and not force_reload:
                logger.info("RAG service already initialized")
                return True
            
            # Check if the vector store already exists
            index_path = os.path.join(self.pdf_folder, "faiss_index")
            
            # If the index exists and we're not forcing a reload, load it
            if os.path.exists(index_path) and not force_reload:
                logger.info(f"Loading existing vector store from {index_path}")
                # Allow deserialization of the FAISS index - this is safe because we control the source
                self.vector_store = FAISS.load_local(
                    index_path, 
                    self.embeddings, 
                    allow_dangerous_deserialization=True
                )
                self.is_initialized = True
                return True
            
            # Otherwise, create a new vector store
            logger.info("Creating new vector store from documents")
            
            # Get PDF files in the folder
            pdf_files = [
                os.path.join(self.pdf_folder, f) 
                for f in os.listdir(self.pdf_folder) 
                if f.lower().endswith('.pdf')
            ]
            
            if not pdf_files:
                logger.error(f"No PDF files found in {self.pdf_folder}")
                return False
            
            # Load and process all PDFs
            documents = []
            for pdf_file in pdf_files:
                logger.info(f"Loading {pdf_file}")
                try:
                    loader = PyPDFLoader(pdf_file)
                    documents.extend(loader.load())
                except Exception as e:
                    logger.error(f"Error loading {pdf_file}: {str(e)}")
            
            # Split documents into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            chunks = text_splitter.split_documents(documents)
            
            # Create vector store
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
            
            # Save the vector store
            os.makedirs(index_path, exist_ok=True)
            self.vector_store.save_local(index_path)
            
            self.is_initialized = True
            logger.info(f"Vector store created and saved to {index_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error initializing RAG service: {str(e)}")
            self.is_initialized = False
            return False
    
    def retrieve_relevant_context(self, query, num_docs=3):
        """
        Retrieve relevant document chunks for a given query
        
        Args:
            query: The query string
            num_docs: Number of relevant documents to retrieve
            
        Returns:
            list: List of relevant document chunks or empty list if error
        """
        try:
            # Ensure the service is initialized
            if not self.is_initialized:
                self.initialize()
            
            if not self.is_initialized or not self.vector_store:
                logger.error("RAG service not properly initialized")
                return []
            
            # Search for relevant documents
            docs = self.vector_store.similarity_search(query, k=num_docs)
            
            # Extract content as strings
            results = [doc.page_content for doc in docs]
            
            return results
            
        except Exception as e:
            logger.error(f"Error retrieving context: {str(e)}")
            return []

# Create a singleton instance
rag_service = RAGService() 