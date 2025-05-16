export const getDarkThemeStyles = (): string => {
  return `
    .theme-dark, 
        body.dark-theme {
          --bg-primary: #1f2937;
          --bg-secondary: #1f2937;
          --text-primary: #f3f4f6;
          --text-secondary: #d1d5db;
          --accent-color: #fd7e14;
          --border-color: #374151;
          --card-bg: #1f2937;
          --input-bg: #374151;
          --hover-color:  #fd7e14;
        }
        
        /* Global styles for dark theme */
        body.dark-theme {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        /* Dashboard container */
        body.dark-theme .dashboard-container {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        /* Main content area */
        body.dark-theme .main-content {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        /* Content area */
        body.dark-theme .content {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        /* Navbar styling */
        body.dark-theme app-navbar,
        body.dark-theme .navbar {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        
        /* Welcome card time color */
        body.dark-theme .current-time {
          color: #d1d5db !important;
        }
        
        /* Doctor management status filters */
        body.dark-theme .status-filters button {
          color: #d1d5db !important;
        }
        
        /* Navbar current page indicator */
        body.dark-theme .breadcrumb-item.current {
          color:rgb(149, 153, 157) !important;
        }
        
        body.dark-theme .navbar-content,
        body.dark-theme .navbar-container {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        
        body.dark-theme .navbar * {
          color: var(--text-primary);
        }
        
        body.dark-theme .navbar .search-box {
          background-color: var(--input-bg);
          border-color: var(--border-color);
        }
        
        body.dark-theme .navbar .search-box input {
          background-color: var(--input-bg);
          color: var(--text-primary);
        }
        
        body.dark-theme .navbar .user-info {
          color: var(--text-primary);
        }
        
        body.dark-theme .navbar .user-menu {
          background-color: var(--bg-secondary);
          border-color: var(--border-color);
        }
        
        /* Sidebar - already properly styled but adding specificity */
        body.dark-theme app-sidebar,
        body.dark-theme .sidebar-container {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme .sidebar-nav-item {
          color: var(--text-primary);
        }
        
        body.dark-theme .sidebar-nav-item.active {
          background-color: rgba(253, 126, 20, 0.1);
          color: var(--accent-color);
          border-left-color: var(--accent-color);
        }
        
        body.dark-theme .sidebar-nav-item:hover {
          background-color: var(--hover-color);
        }
        
        /* Doctor Management page */
        body.dark-theme app-doctor-management .container,
        body.dark-theme app-doctor-management .doctor-management-container {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        body.dark-theme table {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme tr, 
        body.dark-theme td, 
        body.dark-theme th {
          border-color: var(--border-color);
          color: var(--text-primary);
          background-color: var(--card-bg);
        }
        
        body.dark-theme thead,
        body.dark-theme th {
          background-color: var(--bg-secondary);
        }
        
        body.dark-theme .search-input,
        body.dark-theme input[type="search"],
        body.dark-theme input[type="text"] {
          background-color: var(--input-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme .btn-primary,
        body.dark-theme button[type="submit"] {
          background-color: var(--accent-color);
          color: #000000;
        }
        
        body.dark-theme .action-btn {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme .status-badge.active {
          background-color: rgba(0, 200, 81, 0.2);
          color: #42d672;
        }
        
        body.dark-theme .status-badge.inactive {
          background-color: rgba(220, 38, 38, 0.2);
          color: #f87171;
        }
        
        /* Dashboard Cards and Stats */
        body.dark-theme .card,
        body.dark-theme .stat-card,
        body.dark-theme .dashboard-card {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        }
        
        /* Welcome card and quick actions */
        body.dark-theme .quick-actions,
        body.dark-theme [class*="actions-card"],
        body.dark-theme [class*="welcome-card"] {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        }
        
        /* All white cards on dashboard */
        body.dark-theme div[style*="background-color: white"],
        body.dark-theme div[style*="background: white"],
        body.dark-theme div[style*="background-color: #fff"],
        body.dark-theme div[style*="background: #fff"],
        body.dark-theme div[style*="background-color:#fff"],
        body.dark-theme div[style*="background:#fff"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Dashboard statistic cards */
        body.dark-theme .active-doctors,
        body.dark-theme .inactive-doctors,
        body.dark-theme .total-logs,
        body.dark-theme .system-status {
          
          color: var(--text-primary);
        }
        
        /* Fix specific statistic cards by their order */
        body.dark-theme .dashboard-container > div:nth-child(5) > div {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .dashboard-container > div:nth-child(5) > div > div:first-child {
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .dashboard-container > div:nth-child(5) > div > div:last-child {
          color: var(--text-primary) !important;
        }
        
        /* Target all white divs and cards */
        body.dark-theme div[class*="card"],
        body.dark-theme div[class*="Card"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Target common card class names */
        body.dark-theme .card-header,
        body.dark-theme .card-title {
          color: var(--text-primary);
        }
        
        body.dark-theme .card-body,
        body.dark-theme .card-content {
          color: var(--text-secondary);
        }
        
        body.dark-theme .card-footer {
          border-color: var(--border-color);
        }
        
        /* Logs page */
        body.dark-theme app-doctor-logs,
        body.dark-theme .logs-container {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        body.dark-theme .log-entry {
          background-color: var(--card-bg);
          border-color: var(--border-color);
        }
        
        body.dark-theme .filter-controls {
          background-color: var(--card-bg);
          border-color: var(--border-color);
        }
        
        body.dark-theme select {
          background-color: var(--input-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        /* Typography and buttons throughout the app */
        body.dark-theme h1, 
        body.dark-theme h2, 
        body.dark-theme h3, 
        body.dark-theme h4,
        body.dark-theme h5,
        body.dark-theme h6 {
          color: var(--text-primary);
        }
        
        body.dark-theme p, 
        body.dark-theme span, 
        body.dark-theme div {
          color: var(--text-primary);
        }
        
        body.dark-theme button,
        body.dark-theme .btn {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme button.btn-primary,
        body.dark-theme .btn-primary {
          background-color: var(--accent-color);
          color: #000000;
          border-color: var(--accent-color);
        }
        
        body.dark-theme button:hover,
        body.dark-theme .btn:hover {
          background-color: var(--hover-color);
        }
        
        /* Settings page specific styles */
        body.dark-theme .settings-container {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        
        body.dark-theme .settings-main,
        body.dark-theme .section-content {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        
        body.dark-theme .section-header {
          border-color: var(--border-color);
        }
        
        body.dark-theme .section-header h3 {
          color: var(--text-primary);
        }
        
        body.dark-theme .settings-description,
        body.dark-theme .setting-description,
        body.dark-theme .card-content p {
          color: var(--text-secondary);
        }
        
        body.dark-theme .settings-sidebar {
          background-color: var(--bg-secondary);
        }
        
        body.dark-theme .nav-item {
          color: var(--text-secondary);
          border-left-color: transparent;
        }
        
        body.dark-theme .nav-item:hover {
          background-color: var(--hover-color);
          color: var(--text-primary);
        }
        
        body.dark-theme .nav-item.active {
          background-color: rgba(253, 126, 20, 0.1);
          color: var(--accent-color);
          border-left-color: var(--accent-color);
        }
        
        body.dark-theme .settings-card {
          background-color: var(--card-bg);
          border-color: var(--border-color);
        }
        
        body.dark-theme .settings-card:hover {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }
        
        body.dark-theme .card-content h4 {
          color: var(--text-primary);
        }
        
        body.dark-theme .card-icon {
          background-color: var(--hover-color);
          color: var(--accent-color);
          border-color: var(--border-color);
        }
        
        body.dark-theme .settings-group {
          border-color: var(--border-color);
        }
        
        body.dark-theme .settings-group h4 {
          color: var(--text-primary);
        }
        
        body.dark-theme .theme-preview,
        body.dark-theme .contrast-preview {
          border-color: var(--border-color);
        }
        
        body.dark-theme .theme-option span,
        body.dark-theme .contrast-option span {
          color: var(--text-secondary);
        }
        
        body.dark-theme .theme-option.active .theme-preview,
        body.dark-theme .contrast-option.active .contrast-preview {
          border-color: var(--accent-color);
        }
        
        body.dark-theme .btn-back {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }
        
        body.dark-theme .btn-back:hover {
          background-color: var(--hover-color);
        }
        
        body.dark-theme .slider {
          background-color: var(--border-color);
        }
        
        body.dark-theme .toggle-slider {
          background-color: var(--border-color);
        }
        
        body.dark-theme .toggle-slider:before {
          background-color: var(--text-secondary);
        }
        
        body.dark-theme input:checked + .toggle-slider {
          background-color: var(--accent-color);
        }
        
        body.dark-theme .font-size-preview {
          background-color: var(--card-bg);
          border-color: var(--border-color);
        }
        
        body.dark-theme .settings-actions {
          background-color: rgba(253, 126, 20, 0.1);
          border-left-color: var(--accent-color);
        }
        
        body.dark-theme .btn-cancel {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme .btn-save {
          background-color: var(--accent-color);
          color: #000000;
        }
        
        body.dark-theme .btn-cancel:hover {
          background-color: var(--hover-color);
        }
        
        body.dark-theme .header h2 {
          color: var(--text-primary);
        }
        
        /* Welcome text and dashboard header */
        body.dark-theme h2,
        body.dark-theme h2.welcome-text,
        body.dark-theme .welcome-back,
        body.dark-theme div[class*="welcome"] h2 {
          color: var(--text-primary) !important;
        }
        
        /* Last login text */
        body.dark-theme .last-login,
        body.dark-theme div:has(> .last-login) {
          color: var(--text-secondary) !important;
        }
        
        /* Dashboard statistics */
        body.dark-theme .stat-number,
        body.dark-theme .stat-value,
        body.dark-theme .metric-value,
        body.dark-theme .count,
        body.dark-theme [class*="value"] {
          color: var(--text-primary) !important;
        }
        
        /* Dashboard icons in stat cards */
        body.dark-theme .icon-wrapper,
        body.dark-theme .stat-icon,
        body.dark-theme .card-icon {
          background-color: rgba(253, 126, 20, 0.1);
          color: var(--accent-color);
        }
        
        /* System status indicator */
        body.dark-theme .status-indicator,
        body.dark-theme .status-dot {
          
        }
        
        /* Chart background */
        body.dark-theme canvas,
        body.dark-theme .chart-container,
        body.dark-theme [class*="chart"] {
          background-color: var(--card-bg);
          border-color: var(--border-color);
        }
        
        /* Recent activity section */
        body.dark-theme .activity-item,
        body.dark-theme .activity-entry,
        body.dark-theme .log-item {
          background-color: var(--card-bg);
          border-color: var(--border-color);
          color: var(--text-primary);
        }
        
        body.dark-theme .activity-time,
        body.dark-theme .timestamp,
        body.dark-theme .date {
          color: var(--text-secondary);
        }
        
        /* View all button */
        body.dark-theme .view-all {
          color: var(--accent-color);
        }
        
        /* Table rows hover state */
        body.dark-theme tr:hover {
          background-color: var(--hover-color) !important;
        }
        
        /* Inputs and Form Controls - Additional Fixes */
        body.dark-theme input,
        body.dark-theme textarea,
        body.dark-theme select {
          background-color: var(--input-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme ::placeholder {
          color: var(--text-secondary);
        }
        
        body.dark-theme .form-control:focus,
        body.dark-theme select:focus,
        body.dark-theme input:focus {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(253, 126, 20, 0.25);
        }
        
        /* Modals and dialogs */
        body.dark-theme .modal,
        body.dark-theme .dialog,
        body.dark-theme [class*="modal"],
        body.dark-theme [class*="dialog"] {
          background-color: var(--bg-secondary);
          border-color: var(--border-color);
          color: var(--text-primary);
        }
        
        body.dark-theme .modal-header,
        body.dark-theme .dialog-header,
        body.dark-theme [class*="modal-header"],
        body.dark-theme [class*="dialog-header"] {
          border-color: var(--border-color);
        }
        
        body.dark-theme .modal-title,
        body.dark-theme .dialog-title,
        body.dark-theme [class*="modal-title"],
        body.dark-theme [class*="dialog-title"] {
          color: var(--text-primary);
        }
        
        body.dark-theme .modal-footer,
        body.dark-theme .dialog-footer,
        body.dark-theme [class*="modal-footer"],
        body.dark-theme [class*="dialog-footer"] {
          border-color: var(--border-color);
        }
        
        /* Links */
        body.dark-theme a {
          color: var(--accent-color);
        }
        
        body.dark-theme a:hover {
          color: #ffb067;
        }
        
        /* Alert components */
        body.dark-theme .alert {
          background-color: var(--card-bg);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        
        body.dark-theme .alert-success {
          background-color: rgba(74, 222, 128, 0.1);
          border-color: #4ade80;
          color: #4ade80;
        }
        
        body.dark-theme .alert-danger,
        body.dark-theme .alert-error {
          background-color: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
          color: #ef4444;
        }
        
        body.dark-theme .alert-warning {
          background-color: rgba(234, 179, 8, 0.1);
          border-color: #eab308;
          color: #eab308;
        }
        
        body.dark-theme .alert-info {
          background-color: rgba(34, 211, 238, 0.1);
          border-color: #22d3ee;
          color: #22d3ee;
        }
        
        /* Additional Dashboard Fixes */
        body.dark-theme .welcome-back,
        body.dark-theme .card .welcome-back,
        body.dark-theme .welcome-banner {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Quick Actions and Cards */
        body.dark-theme div.quick-actions {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .quick-actions-card,
        body.dark-theme .actions-container {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Dashboard white boxes */
        body.dark-theme .white-card,
        body.dark-theme .white-box,
        body.dark-theme div[style*="background: white"],
        body.dark-theme .dashboard-container > div > div {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Logs page specific styling */
        body.dark-theme .logs-page,
        body.dark-theme .logs-header,
        body.dark-theme .logs-container {
          background-color: var(--bg-primary) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .filter-row,
        body.dark-theme .search-box,
        body.dark-theme .filter-container {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme input[type="text"],
        body.dark-theme input[type="search"],
        body.dark-theme input[type="date"],
        body.dark-theme select.form-control {
          background-color: var(--input-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .logs-table,
        body.dark-theme .logs-table tr,
        body.dark-theme .logs-table td {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .logs-table th {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .log-row:nth-child(odd) {
          background-color: var(--card-bg) !important;
        }
        
        body.dark-theme .log-row:nth-child(even) {
          background-color: var(--bg-secondary) !important;
        }
        
        /* Profile page styling */
        body.dark-theme .profile-page,
        body.dark-theme .profile-container {
          background-color: var(--bg-primary) !important;
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .profile-header,
        body.dark-theme .profile-section,
        body.dark-theme .profile-card {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .profile-info-row,
        body.dark-theme .profile-label,
        body.dark-theme .profile-value {
          color: var(--text-primary) !important;
        }
        
        /* Buttons and action elements */
        body.dark-theme .btn-action,
        body.dark-theme .action-button {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .btn-primary,
        body.dark-theme .primary-button,
        body.dark-theme button[type="submit"],
        body.dark-theme .submit-button {
          background-color: var(--accent-color) !important;
          color: #000000 !important;
          border-color: var(--accent-color) !important;
        }
        
        /* Notification/alert banner */
        body.dark-theme .info-banner,
        body.dark-theme .notification-banner {
          background-color: rgba(59, 130, 246, 0.15) !important;
          color: #93c5fd !important;
          border-color: #3b82f6 !important;
        }
        
        /* Force style all tables */
        body.dark-theme table,
        body.dark-theme tbody,
        body.dark-theme tr,
        body.dark-theme td,
        body.dark-theme th {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Force white text on sidebar */
        body.dark-theme .sidebar * {
          color: var(--text-primary) !important;
        }
        
        /* Welcome section styling */
        body.dark-theme .welcome-back h2,
        body.dark-theme .welcome-text,
        body.dark-theme h2[class*="welcome"],
        body.dark-theme [class*="welcome"] h2 {
          color: var(--text-primary) !important;
        }
        
        body.dark-theme .last-login,
        body.dark-theme .login-info,
        body.dark-theme [class*="login-time"],
        body.dark-theme [class*="login-date"] {
          color: var(--text-secondary) !important;
        }
        
        /* Account Information Section */
        body.dark-theme [class*="account-information"],
        body.dark-theme [class*="account-info"],
        body.dark-theme [class*="personal-information"],
        body.dark-theme [class*="personal-info"],
        body.dark-theme [class*="contact-information"],
        body.dark-theme [class*="contact-info"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Info labels on profile page */
        body.dark-theme .info-label,
        body.dark-theme [class*="-label"],
        body.dark-theme [class*="info-label"] {
          color: var(--text-secondary) !important;
        }
        
        /* Info values on profile page */
        body.dark-theme .info-value,
        body.dark-theme [class*="-value"],
        body.dark-theme [class*="info-value"] {
          color: var(--text-primary) !important;
        }
        
        /* Action buttons */
        body.dark-theme .btn-back,
        body.dark-theme [class*="btn-back"],
        body.dark-theme [class*="back-button"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .btn-edit,
        body.dark-theme [class*="btn-edit"],
        body.dark-theme [class*="edit-button"] {
          background-color: rgba(59, 130, 246, 0.1) !important;
          color: #60a5fa !important;
          border-color: #3b82f6 !important;
        }
        
        /* Force dark backgrounds on problematic elements with inline styles */
        body.dark-theme [style*="background-color: white"],
        body.dark-theme [style*="background-color:#fff"],
        body.dark-theme [style*="background-color: #fff"],
        body.dark-theme [style*="background-color:#ffffff"],
        body.dark-theme [style*="background-color: #ffffff"],
        body.dark-theme [style*="background:white"],
        body.dark-theme [style*="background:#fff"],
        body.dark-theme [style*="background: #fff"],
        body.dark-theme [style*="background:#ffffff"],
        body.dark-theme [style*="background: #ffffff"] {
          background-color: var(--card-bg) !important;
        }
        
        /* Force dark text on problematic elements with inline styles */
        body.dark-theme [style*="color: black"],
        body.dark-theme [style*="color:#000"],
        body.dark-theme [style*="color: #000"],
        body.dark-theme [style*="color:#000000"],
        body.dark-theme [style*="color: #000000"] {
          color: var(--text-primary) !important;
        }
        
        /* Card section headers */
        body.dark-theme .card-header,
        body.dark-theme .panel-header,
        body.dark-theme [class*="card-header"],
        body.dark-theme [class*="panel-header"] {
          background-color: var(--bg-secondary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Override for action buttons in colored backgrounds */
        body.dark-theme button.update-doctor,
        body.dark-theme button.update-permissions,
        body.dark-theme [class*="update-doctor"],
        body.dark-theme [class*="update-permissions"] {
          background-color: #3b82f6 !important;
          color: white !important;
        }
        
        /* Table row alternate coloring */
        body.dark-theme tr:nth-child(odd) {
          background-color: var(--card-bg) !important;
        }
        
        body.dark-theme tr:nth-child(even) {
          background-color: var(--bg-secondary) !important;
        }
        
        /* Additional buttons in logs page */
        body.dark-theme .btn-apply,
        body.dark-theme .btn-reset,
        body.dark-theme .btn-export,
        body.dark-theme .btn-debug,
        body.dark-theme button[class*="apply"],
        body.dark-theme button[class*="reset"],
        body.dark-theme button[class*="export"],
        body.dark-theme button[class*="debug"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Date inputs and placeholders */
        body.dark-theme input[type="date"] {
          background-color: var(--input-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme input::placeholder {
          color: var(--text-secondary) !important;
        }
        
        /* Misc elements - catch all approach */
        body.dark-theme div[class*="white-bg"],
        body.dark-theme div[class*="white_bg"],
        body.dark-theme div[class*="light-bg"],
        body.dark-theme div[class*="light_bg"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* More compatible selectors for specific elements */
        /* Welcome back card - direct approach */
        body.dark-theme .welcome-banner,
        body.dark-theme .welcome-card,
        body.dark-theme .welcome-section,
        body.dark-theme .welcome-container {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Recent activity and logs */
        body.dark-theme .recent-activity,
        body.dark-theme .activity-container,
        body.dark-theme .logs-activity,
        body.dark-theme .activity-section {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Graph and chart containers */
        body.dark-theme .graph-container,
        body.dark-theme .chart-wrapper,
        body.dark-theme .overview-chart,
        body.dark-theme .activity-chart {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Filter row in logs page */
        body.dark-theme .filter-container,
        body.dark-theme .search-filters,
        body.dark-theme .logs-filters,
        body.dark-theme .filters-row {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
          padding: 15px !important;
          border-radius: 8px !important;
        }
        
        /* Pagination with standard class names */
        body.dark-theme .pagination,
        body.dark-theme .pagination-container,
        body.dark-theme .page-navigation,
        body.dark-theme .pages-nav {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .page-item,
        body.dark-theme .page-link,
        body.dark-theme .page-number,
        body.dark-theme .page-button {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        body.dark-theme .page-item.active,
        body.dark-theme .page-link.active,
        body.dark-theme .page-number.active,
        body.dark-theme .page-button.active,
        body.dark-theme .active > .page-link {
          background-color: var(--accent-color) !important;
          color: #000000 !important;
          border-color: var(--accent-color) !important;
        }
        
        /* Force all white backgrounds in the app to use dark theme */
        body.dark-theme * {
          background-color: inherit;
        }
        
        body.dark-theme *[style*="background-color: white"],
        body.dark-theme *[style*="background-color:#fff"],
        body.dark-theme *[style*="background: white"],
        body.dark-theme *[style*="background:#fff"] {
          background-color: var(--card-bg) !important;
        }
        
        /* Direct targeting of specific elements */
        /* Dashboard cards by Angular component patterns */
        body.dark-theme app-dashboard > div > div,
        body.dark-theme app-dashboard div[class$="card"],
        body.dark-theme app-dashboard div[class$="container"],
        body.dark-theme app-dashboard div[class$="section"],
        body.dark-theme app-dashboard div[class*="-card"],
        body.dark-theme app-dashboard div[class*="-container"],
        body.dark-theme app-dashboard div[class*="box"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Angular component specific selectors */
        body.dark-theme app-welcome-card,
        body.dark-theme app-stats-card,
        body.dark-theme app-activity-feed,
        body.dark-theme app-chart,
        body.dark-theme app-recent-activity,
        body.dark-theme app-doctor-activity {
          background-color: transparent !important;
        }
        
        body.dark-theme app-welcome-card > div,
        body.dark-theme app-stats-card > div,
        body.dark-theme app-activity-feed > div,
        body.dark-theme app-chart > div,
        body.dark-theme app-recent-activity > div,
        body.dark-theme app-doctor-activity > div {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Logs components */
        body.dark-theme app-doctor-logs > div,
        body.dark-theme app-logs > div,
        body.dark-theme app-log-filters > div,
        body.dark-theme app-logs-table > div,
        body.dark-theme app-pagination > div {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Bootstrap-style pagination */
        body.dark-theme .pagination,
        body.dark-theme ul.pagination,
        body.dark-theme nav ul.pagination,
        body.dark-theme app-pagination nav {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Force apply dark theme to any remaining white elements */
        body.dark-theme *[class*="bg-white"],
        body.dark-theme *[class*="background-white"],
        body.dark-theme .bg-white,
        body.dark-theme .bg-light,
        body.dark-theme .card,
        body.dark-theme .white-bg {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }
        
        /* Force canvas to be transparent */
        body.dark-theme canvas {
          background-color: transparent !important;
        }
        
        /* Target specific element IDs that might be used */
        body.dark-theme #welcomeCard,
        body.dark-theme #activityCard,
        body.dark-theme #overviewChart,
        body.dark-theme #filtersContainer,
        body.dark-theme #paginationContainer {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Final extremely aggressive approach for specific elements the user mentioned */
        /* 1. Welcome back card */
        body.dark-theme .dashboard-container > div:first-of-type > div:first-of-type {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* 2. Recent activity card */
        body.dark-theme div:nth-of-type(6) > div:first-of-type,
        body.dark-theme [id*="recent"],
        body.dark-theme [id*="activity"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* 3. Doctor activity overview graph */
        body.dark-theme div:nth-of-type(7) > div:first-of-type,
        body.dark-theme [id*="chart"],
        body.dark-theme [id*="graph"],
        body.dark-theme [id*="overview"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* 4. Filter section in logs page */
        body.dark-theme .logs-container > div:nth-of-type(2),
        body.dark-theme [id*="filter"],
        body.dark-theme [id*="search"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
          padding: 15px !important;
          border-radius: 8px !important;
        }
        
        /* 5. Pagination section */
        body.dark-theme .logs-container > div:last-of-type,
        body.dark-theme [id*="pagination"],
        body.dark-theme [id*="paging"],
        body.dark-theme [class*="pagination"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        
        /* Super aggressive override for any elements with inline styles */
        body.dark-theme [style*="background"] {
          background-color: var(--card-bg) !important;
        }
        
        /* Force all white backgrounds regardless of how they're applied */
        body.dark-theme div[style],
        body.dark-theme section[style],
        body.dark-theme aside[style],
        body.dark-theme main[style],
        body.dark-theme nav[style] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
        }

        /* Dashboard panels in dark mode */
        body.dark-theme .dashboard-panel {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
        }

        body.dark-theme .dashboard-panel .panel-header {
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        body.dark-theme .dashboard-panel h3 {
          color: var(--text-primary);
        }

        body.dark-theme .dashboard-panel .panel-content {
          background-color: var(--card-bg);
        }

        /* Chart container in dark mode */
        body.dark-theme .chart-container {
          background-color: var(--card-bg);
        }

        body.dark-theme .placeholder-chart svg {
          background-color: var(--bg-secondary);
        }

        body.dark-theme .placeholder-chart path {
          stroke-width: 3px;
        }

        body.dark-theme .legend-item {
          color: var(--text-primary);
        }

        /* Doctor logs filters section in dark mode */
        body.dark-theme .logs-viewer-container .filters {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
        }

        /* Profile page section headers in dark mode */
        body.dark-theme .profile-section .section-header {
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        body.dark-theme .profile-section .section-header h3 {
          color: var(--text-primary);
        }

        /* Dropdown menu in navbar dark mode */
        body.dark-theme .navbar .dropdown-menu {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        body.dark-theme .navbar .dropdown-item {
          color: var(--text-primary);
        }

        body.dark-theme .navbar .dropdown-item:hover {
          background-color: var(--hover-color);
        }

        body.dark-theme .navbar .dropdown-divider {
          background-color: var(--border-color);
        }

        /* Chart container and doctor activity overview in dark mode - completely new styling */
        body.dark-theme .dashboard-panel.doctor-activity {
          background-color: var(--card-bg) !important;
          border: 1px solid var(--border-color) !important;
        }

        body.dark-theme .dashboard-panel.doctor-activity .panel-header {
          background-color: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border-color) !important;
        }

        body.dark-theme .dashboard-panel.doctor-activity .panel-content {
          background-color: var(--card-bg) !important;
        }

        body.dark-theme .chart-container {
          background-color: var(--card-bg) !important;
        }

        /* Targeting the SVG directly with very high specificity */
        html body.dark-theme .dashboard-panel.doctor-activity .panel-content .chart-container .placeholder-chart svg {
          background-color: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }

        /* Direct style for the placeholder chart */
        html body.dark-theme .placeholder-chart {
          background-color: var(--card-bg) !important;
        }

        /* Increase visibility of the graph lines with !important */
        html body.dark-theme .placeholder-chart svg path[stroke="#4CAF50"] {
          stroke: #6deb7b !important;
          stroke-width: 3px !important;
        }

        html body.dark-theme .placeholder-chart svg path[stroke="#2196F3"] {
          stroke: #5eb8ff !important;
          stroke-width: 3px !important;
        }

        /* Added !important to all legend styles */
        body.dark-theme .chart-legend {
          background-color: var(--card-bg) !important;
        }

        body.dark-theme .legend-item {
          color: var(--text-primary) !important;
        }

        body.dark-theme .legend-item span:not(.legend-color) {
          color: var(--text-primary) !important;
        }

        /* Force new colors for legend color indicators */
        html body.dark-theme .legend-color[style*="background-color: #4CAF50"] {
          background-color: #6deb7b !important;
          border: 1px solid var(--border-color) !important;
        }

        html body.dark-theme .legend-color[style*="background-color: #2196F3"] {
          background-color: #5eb8ff !important;
          border: 1px solid var(--border-color) !important;
        }

        /* Override any inline styles by targeting the exact SVG element */
        html body.dark-theme .dashboard-panel.doctor-activity svg[viewBox="0 0 500 200"] {
          background-color: var(--bg-secondary) !important;
          border: 1px solid var(--border-color) !important;
        }

        /* Add fallback for any SVG in the chart */
        html body.dark-theme .dashboard-panel.doctor-activity svg {
          background-color: var(--bg-secondary) !important;
        }

        /* Improve section title readability in dark mode */
        html body.dark-theme h3,
        html body.dark-theme .quick-actions h3,
        html body.dark-theme .panel-header h3,
        html body.dark-theme .section-header h3,
        html body.dark-theme .dashboard-panel h3,
        html body.dark-theme [class*="section"] h3,
        html body.dark-theme [class*="panel"] h3,
        html body.dark-theme [class*="card"] h3 {
          color: #ffffff !important;
          font-weight: 600 !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
        }

        /* Also improve dashboard card titles */
        html body.dark-theme .card-content h3,
        html body.dark-theme .stats-card h3 {
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        /* Comprehensive fix for ALL headings in dark mode */
        html body.dark-theme h1,
        html body.dark-theme h2,
        html body.dark-theme h3,
        html body.dark-theme h4,
        html body.dark-theme h5,
        html body.dark-theme h6,
        html body.dark-theme .h1,
        html body.dark-theme .h2,
        html body.dark-theme .h3,
        html body.dark-theme .h4,
        html body.dark-theme .h5,
        html body.dark-theme .h6,
        html body.dark-theme [class*="title"],
        html body.dark-theme [class*="header"] h1,
        html body.dark-theme [class*="header"] h2,
        html body.dark-theme [class*="header"] h3,
        html body.dark-theme [class*="header"] h4,
        html body.dark-theme [class*="section"] h1,
        html body.dark-theme [class*="section"] h2,
        html body.dark-theme [class*="section"] h3,
        html body.dark-theme [class*="section"] h4,
        html body.dark-theme [class*="panel"] h1,
        html body.dark-theme [class*="panel"] h2,
        html body.dark-theme [class*="panel"] h3,
        html body.dark-theme [class*="panel"] h4,
        html body.dark-theme [class*="card"] h1,
        html body.dark-theme [class*="card"] h2,
        html body.dark-theme [class*="card"] h3,
        html body.dark-theme [class*="card"] h4 {
          color: #ffffff !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
        }

        /* Specific fixes for dashboard elements */
        html body.dark-theme .quick-actions h3,
        html body.dark-theme .dashboard-panel h3,
        html body.dark-theme .panel-header h3,
        html body.dark-theme .stats-card h3,
        html body.dark-theme .card-content h3 {
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        /* Specific fixes for section headers across all tech pages */
        html body.dark-theme .doctor-management-container h3,
        html body.dark-theme .logs-viewer-container h3,
        html body.dark-theme .logs-viewer-container h2,
        html body.dark-theme .filters h3,
        html body.dark-theme .filters h4,
        html body.dark-theme .profile-container h3,
        html body.dark-theme .profile-container h2,
        html body.dark-theme .section-header h3,
        html body.dark-theme .settings-container h3,
        html body.dark-theme .settings-container h4 {
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        /* Super aggressive targeting for any heading by element type */
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h1,
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h2,
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h3,
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h4,
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h5,
        html body.dark-theme *:not(.sidebar):not(.sidebar *) h6 {
          color: #ffffff !important;
        }

        /* Fix dropdown hover background in dark mode - more aggressive approach */
        html body.dark-theme .dropdown-menu .dropdown-item:hover,
        html body.dark-theme .user-profile .dropdown-menu .dropdown-item:hover,
        html body.dark-theme .user-profile .dropdown-item:hover,
        html body.dark-theme .navbar .dropdown-menu .dropdown-item:hover,
        html body.dark-theme .navbar-actions .dropdown-menu .dropdown-item:hover,
        html body.dark-theme .dropdown-item:hover,
        html body.dark-theme [class*="dropdown"] [class*="item"]:hover,
        html body.dark-theme [class*="dropdown-menu"] > *:hover {
          background-color: #2d3748 !important; /* Hard-coded darker color */
          color: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* Override navbar dropdown specifically */
        html body.dark-theme .navbar-actions .user-profile .dropdown-menu .dropdown-item:hover {
          background-color: #2d3748 !important;
          color: #ffffff !important;
          border: none !important;
        }

        /* Override specifically for user-profile hover state */
        html body.dark-theme .user-profile:hover {
          background-color: #2d3748 !important;
        }

        /* Forcefully remove white backgrounds from any dropdown elements */
        html body.dark-theme .dropdown-menu *:hover,
        html body.dark-theme [class*="dropdown"] *:hover {
          background-color: #2d3748 !important;
        }

        /* Override inline styles specifically */
        html body.dark-theme [style*="background-color: white"]:hover,
        html body.dark-theme [style*="background-color: #fff"]:hover,
        html body.dark-theme [style*="background-color: #ffffff"]:hover,
        html body.dark-theme [style*="background: white"]:hover,
        html body.dark-theme [style*="background: #fff"]:hover,
        html body.dark-theme [style*="background: #ffffff"]:hover {
          background-color: #2d3748 !important;
        }

        /* Direct fix for user profile dropdown in navbar */
        html body.dark-theme .navbar .user-profile,
        html body.dark-theme .navbar-actions .user-profile {
          background-color: transparent !important;
        }

        html body.dark-theme .navbar .user-profile:hover,
        html body.dark-theme .navbar-actions .user-profile:hover {
          background-color: #2d3748 !important;
        }

        html body.dark-theme .navbar .user-profile .dropdown-menu,
        html body.dark-theme .navbar-actions .user-profile .dropdown-menu {
          background-color: #1f2937 !important;
          border: 1px solid #4b5563 !important;
        }

        html body.dark-theme .navbar .user-profile .dropdown-menu .dropdown-item,
        html body.dark-theme .navbar-actions .user-profile .dropdown-menu .dropdown-item {
          background-color: transparent !important;
          color: #ffffff !important;
        }

        html body.dark-theme .navbar .user-profile .dropdown-menu .dropdown-item:hover,
        html body.dark-theme .navbar-actions .user-profile .dropdown-menu .dropdown-item:hover {
          background-color: #2d3748 !important;
          color: #ffffff !important;
        }

        html body.dark-theme .navbar .user-profile .dropdown-divider,
        html body.dark-theme .navbar-actions .user-profile .dropdown-divider {
          background-color: #4b5563 !important;
          border-color: #4b5563 !important;
        }

        /* Dashboard Recent Activity - Make background dark */
        body.dark-theme .recent-activity-container,
        body.dark-theme .recent-activity,
        body.dark-theme .activity-list,
        body.dark-theme .activity-item {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }

        /* Doctor Activity Overview Graph - Make dark */
        body.dark-theme .activity-graph,
        body.dark-theme .graph-container,
        body.dark-theme .chart-container,
        body.dark-theme [class*="chart"],
        body.dark-theme [class*="Chart"] {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }

        /* Filters section in Doctor Logs Page - Make dark */
        body.dark-theme .filters-container,
        body.dark-theme .filter-section,
        body.dark-theme .filter-controls,
        body.dark-theme .filter-options {
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }

        /* Profile Page Section Headers - Make dark */
        body.dark-theme .profile-section-header,
        body.dark-theme .account-information,
        body.dark-theme .personal-information,
        body.dark-theme .section-title,
        body.dark-theme [class*="section-header"],
        body.dark-theme [class*="section-title"] {
          background-color: var(--card-bg) !important;
          color: #ffffff !important;
          border-color: var(--border-color) !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
        }

        /* Make all headings white with text shadow for better contrast */
        body.dark-theme h1, 
        body.dark-theme h2, 
        body.dark-theme h3, 
        body.dark-theme h4,
        body.dark-theme h5,
        body.dark-theme h6,
        body.dark-theme .section-header h3,
        body.dark-theme .card-header h3,
        body.dark-theme .card-title {
          color: #ffffff !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
        }

        /* Dropdown Menu in Top Right - Make dark */
        body.dark-theme .dropdown-menu,
        body.dark-theme .dropdown-content,
        body.dark-theme .user-dropdown,
        body.dark-theme .navbar .dropdown-menu,
        body.dark-theme [class*="dropdown"] {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }

        /* Fix dropdown menu items on hover */
        body.dark-theme .dropdown-menu .dropdown-item:hover,
        body.dark-theme .dropdown-content .dropdown-item:hover,
        body.dark-theme .user-dropdown .dropdown-item:hover,
        body.dark-theme .navbar .dropdown-menu .dropdown-item:hover,
        body.dark-theme [class*="dropdown"] [class*="dropdown-item"]:hover,
        body.dark-theme [class*="dropdown"] a:hover,
        body.dark-theme [class*="dropdown"] button:hover {
          background-color: var(--hover-color) !important;
          color: var(--text-primary) !important;
        }
      `;

  
}; 