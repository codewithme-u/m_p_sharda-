import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // ✅ Required for Analytics
import { AuthService } from '../../../core/services/AuthService/auth.service';
import { QuizService } from '../../../core/services/QuizService/quiz.service';
import { UserService } from '../../../core/services/UserService/user.service';
import { Quiz } from '../../../../../INTERFACE/quiz';
import { QuizHistory } from '../../../../../INTERFACE/quiz-history';

declare var bootstrap: any;

@Component({
  selector: 'app-general-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './general-dashboard.component.html',
  styleUrl: './general-dashboard.component.css'
})
export class GeneralDashboardComponent implements OnInit {

  // --- STATE MANAGEMENT ---
  currentView: 'dashboard' | 'library' | 'history' | 'settings' = 'dashboard';

  // User Data
  currentUser: any = {
    name: 'Player',
    email: '',
    profileImageUrl: null
  };

  // Settings Data
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  selectedProfileImage: File | null = null;
  imagePreview: string | null = null;

  // Quiz Data
  joinCode: string = '';
  myQuizzes: Quiz[] = [];
  newQuiz = { title: '', description: '' };

  // History Data
  historyList: QuizHistory[] = [];
  filteredHistory: QuizHistory[] = [];
  historySearch: string = '';

  // ✅ ANALYTICS DATA
  reportParticipants: any[] = [];
  filteredParticipants: any[] = [];
  selectedReportQuiz: string = '';
  activeFilter: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW' = 'ALL';

  constructor(
    private auth: AuthService, 
    private router: Router,
    private quizService: QuizService,
    private userService: UserService,
    private http: HttpClient // ✅ Injected for Analytics API
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadQuizzes();
    this.loadHistory(); 

    // Auto-refresh data when changes happen (Create/Delete)
    this.quizService.refreshNeeded$.subscribe(() => {
      this.loadQuizzes();
      this.loadHistory();
    });
  }

  // --- VIEW NAVIGATION ---
  switchView(view: 'dashboard' | 'library' | 'history' | 'settings') {
    this.currentView = view;
    window.scrollTo(0,0);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  // --- API & DATA LOADING ---

  loadUserProfile() {
    this.userService.getMe().subscribe({
      next: (data) => {
        this.currentUser = data;
        if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
          this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
        }
      },
      error: (err) => console.error('Failed to load profile', err)
    });
  }

  loadQuizzes() {
    this.quizService.getAll().subscribe({
      next: (data) => this.myQuizzes = data,
      error: (err) => console.error('Failed to load quizzes', err)
    });
  }

  loadHistory() {
    this.quizService.getHistory().subscribe({
      next: (data) => {
        this.historyList = data;
        this.filterHistory(); // Initialize filter
      },
      error: (err) => console.error('Failed to load history', err)
    });
  }

  // --- HISTORY LOGIC ---

  filterHistory() {
    if (!this.historySearch) {
      this.filteredHistory = [...this.historyList];
    } else {
      const term = this.historySearch.toLowerCase();
      this.filteredHistory = this.historyList.filter(h => 
        h.quizTitle.toLowerCase().includes(term) || 
        h.quizCode.toLowerCase().includes(term)
      );
    }
  }

  // --- ANALYTICS & REPORT LOGIC ---

  openAnalyticsModal(quizId: number, quizTitle: string) {
    this.selectedReportQuiz = quizTitle;
    this.activeFilter = 'ALL';
    this.filteredParticipants = []; // Clear previous

    this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
      next: (data) => {
        this.reportParticipants = data;
        this.filteredParticipants = data; // Show all initially
        const modal = new bootstrap.Modal(document.getElementById('analyticsModal'));
        modal.show();
      },
      error: () => alert('Failed to load report data')
    });
  }

  applyFilter(type: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW') {
    this.activeFilter = type;
    let data = [...this.reportParticipants];

    switch (type) {
      case 'ALL':
        this.filteredParticipants = data;
        break;
      case 'PASS':
        this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) >= 0.5);
        break;
      case 'FAIL':
        this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) < 0.5);
        break;
      case 'TOP':
        this.filteredParticipants = data.sort((a, b) => b.score - a.score);
        break;
      case 'LOW':
        this.filteredParticipants = data.sort((a, b) => a.score - b.score);
        break;
    }
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  // Helper for progress bars (used in History & Analytics)
  getPercentage(score: number, total: number): number {
    return total === 0 ? 0 : Math.round((score / total) * 100);
  }

  // --- QUIZ ACTIONS ---

  joinQuiz() {
    if (!this.joinCode.trim()) { alert('Enter code!'); return; }
    this.router.navigate(['/play', this.joinCode]);
  }

  openCreateModal() {
    this.newQuiz = { title: '', description: '' }; 
    const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
    modal.show();
  }

  createQuiz() {
    if (!this.newQuiz.title.trim()) return;
    this.quizService.create(this.newQuiz.title, this.newQuiz.description).subscribe({
        next: (q) => {
            const el = document.getElementById('createQuizModal');
            if (el) bootstrap.Modal.getInstance(el).hide();
            this.switchView('library');
            alert(`Quiz Created! Code: ${q.code}`);
        }
    });
  }

  copyLink(code: string) {
    const link = `http://localhost:4200/play/${code}`;
    navigator.clipboard.writeText(link).then(() => alert('Copied link to clipboard!'));
  }

  deleteQuiz(id: number) {
    if(confirm('Are you sure you want to delete this quiz?')) {
        this.quizService.delete(id).subscribe();
    }
  }

  // --- PROFILE SETTINGS ACTIONS ---

  openProfileModal() {
    this.switchView('settings');
  }

  onProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedProfileImage = input.files[0];
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(this.selectedProfileImage);
    }
  }

  updateProfile() {
    const formData = new FormData();
    formData.append('name', this.currentUser.name);
    if (this.selectedProfileImage) {
      formData.append('profileImage', this.selectedProfileImage);
    }

    this.userService.updateProfile(formData).subscribe({
      next: () => {
        alert('Profile updated successfully!');
        this.loadUserProfile();
      },
      error: () => alert('Update failed')
    });
  }

  changePassword() {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    this.userService.changePassword(this.passwordData).subscribe({
      next: () => {
        alert('Password changed successfully!');
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => alert(err.error || 'Password change failed')
    });
  }
}


// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history'; // ✅ Import

// declare var bootstrap: any;

// @Component({
//   selector: 'app-general-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './general-dashboard.component.html',
//   styleUrl: './general-dashboard.component.css'
// })
// export class GeneralDashboardComponent implements OnInit {

//   // --- STATE MANAGEMENT ---
//   currentView: 'dashboard' | 'library' | 'history' | 'settings' = 'dashboard';

//   // User Data
//   currentUser: any = {
//     name: 'Player',
//     email: '',
//     profileImageUrl: null
//   };

//   // Settings Data
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // Quiz Data
//   joinCode: string = '';
//   myQuizzes: Quiz[] = [];
//   newQuiz = { title: '', description: '' };

//   // ✅ REAL-TIME HISTORY (Starts empty, fills from DB)
//   historyList: QuizHistory[] = [];
//   filteredHistory: QuizHistory[] = [];
//   historySearch: string = '';

//   constructor(
//     private auth: AuthService, 
//     private router: Router,
//     private quizService: QuizService,
//     private userService: UserService
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadQuizzes();
//     this.loadHistory(); // ✅ Load History on Startup

//     // Auto-refresh data when changes happen
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//       this.loadHistory();
//     });
//   }

//   // --- VIEW NAVIGATION ---
//   switchView(view: 'dashboard' | 'library' | 'history' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0);
//   }

//   // --- API & LOGIC ---

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         this.currentUser = data;
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }
//       },
//       error: (err) => console.error('Failed to load profile', err)
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data) => this.myQuizzes = data,
//       error: (err) => console.error(err)
//     });
//   }

// // ✅ Updated Load History
//   loadHistory() {
//     this.quizService.getHistory().subscribe({
//       next: (data) => {
//         this.historyList = data;
//         this.filterHistory(); // Initial filter
//       },
//       error: (err) => console.error('Failed to load history', err)
//     });
//   }

//   // ✅ New Filter Logic
//   filterHistory() {
//     if (!this.historySearch) {
//       this.filteredHistory = [...this.historyList];
//     } else {
//       const term = this.historySearch.toLowerCase();
//       this.filteredHistory = this.historyList.filter(h => 
//         h.quizTitle.toLowerCase().includes(term) || 
//         h.quizCode.toLowerCase().includes(term)
//       );
//     }
//   }
  
//   // Helper to get percentage for progress bar
//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   // --- ACTION METHODS ---

//   joinQuiz() {
//     if (!this.joinCode.trim()) { alert('Enter code!'); return; }
//     // Navigate to the play route with the code
//     this.router.navigate(['/play', this.joinCode]);
//   }

//   openCreateModal() {
//     this.newQuiz = { title: '', description: '' }; 
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   openProfileModal() {
//     this.switchView('settings');
//   }

//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name);
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }

//     this.userService.updateProfile(formData).subscribe({
//       next: () => {
//         alert('Profile updated successfully!');
//         this.loadUserProfile();
//       },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('New passwords do not match!');
//       return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => {
//         alert('Password changed successfully!');
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//       },
//       error: (err) => alert(err.error || 'Password change failed')
//     });
//   }

//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
//     this.quizService.create(this.newQuiz.title, this.newQuiz.description).subscribe({
//         next: (q) => {
//             const el = document.getElementById('createQuizModal');
//             if (el) bootstrap.Modal.getInstance(el).hide();
//             this.switchView('library');
//             alert(`Quiz Created! Code: ${q.code}`);
//         }
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Copied!'));
//   }

//   deleteQuiz(id: number) {
//     if(confirm('Delete?')) {
//         this.quizService.delete(id).subscribe();
//     }
//   }
// }


// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';
// import { QuizHistory } from '../../../../../INTERFACE/quiz-history'; // Import interface

// declare var bootstrap: any;

// @Component({
//   selector: 'app-general-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './general-dashboard.component.html',
//   styleUrl: './general-dashboard.component.css'
// })
// export class GeneralDashboardComponent implements OnInit {

//   currentView: 'dashboard' | 'library' | 'history' | 'settings' = 'dashboard';

//   currentUser: any = { name: 'Player', email: '', profileImageUrl: null };
  
//   // Real Data Containers
//   myQuizzes: Quiz[] = [];
//   historyList: QuizHistory[] = []; // ✅ Now starts empty, fills from DB

//   joinCode: string = '';
//   newQuiz = { title: '', description: '' };
  
//   // Settings
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   constructor(
//     private auth: AuthService, 
//     private router: Router,
//     private quizService: QuizService,
//     private userService: UserService
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadQuizzes();
//     this.loadHistory(); // ✅ Fetch Real History

//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//       this.loadHistory(); // Refresh history if needed
//     });
//   }

//   // --- DATA LOADING ---

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         this.currentUser = data;
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }
//       }
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data) => this.myQuizzes = data
//     });
//   }

//   // ✅ NEW: Fetch History
//   loadHistory() {
//     this.quizService.getHistory().subscribe({
//       next: (data) => {
//         this.historyList = data;
//       },
//       error: (err) => console.error('Failed to load history', err)
//     });
//   }

//   // --- VIEW SWITCHING ---
//   switchView(view: 'dashboard' | 'library' | 'history' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0);
//   }

//   // --- ACTIONS ---
//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   joinQuiz() {
//     if (!this.joinCode.trim()) { alert('Enter code!'); return; }
//     // Logic to verify code and start game will go here
//     alert('Connecting to quiz...');
//   }

//   // ... (Keep openCreateModal, createQuiz, updateProfile, etc. exactly as before)
//   openCreateModal() {
//     this.newQuiz = { title: '', description: '' }; 
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   openProfileModal() {
//     this.switchView('settings');
//   }

//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name);
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }
//     this.userService.updateProfile(formData).subscribe({
//       next: () => {
//         alert('Profile updated successfully!');
//         this.loadUserProfile();
//       },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('New passwords do not match!');
//       return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => {
//         alert('Password changed successfully!');
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//       },
//       error: (err) => alert(err.error || 'Password change failed')
//     });
//   }

//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
//     this.quizService.create(this.newQuiz.title, this.newQuiz.description).subscribe({
//         next: (q) => {
//             const el = document.getElementById('createQuizModal');
//             if (el) bootstrap.Modal.getInstance(el).hide();
//             this.switchView('library');
//             alert(`Quiz Created! Code: ${q.code}`);
//         }
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Copied!'));
//   }

//   deleteQuiz(id: number) {
//     if(confirm('Delete?')) {
//         this.quizService.delete(id).subscribe();
//     }
//   }
// }

// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';

// declare var bootstrap: any;

// interface QuizHistory {
//   id: number;
//   quizTitle: string;
//   score: number;
//   totalQuestions: number;
//   dateAttempted: string;
//   status: 'Completed' | 'Incomplete';
// }

// @Component({
//   selector: 'app-general-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './general-dashboard.component.html',
//   styleUrl: './general-dashboard.component.css'
// })
// export class GeneralDashboardComponent implements OnInit {

//   // --- STATE MANAGEMENT ---
//   currentView: 'dashboard' | 'library' | 'history' | 'settings' = 'dashboard';

//   // User Data
//   currentUser: any = {
//     name: 'Player',
//     email: '',
//     profileImageUrl: null
//   };

//   // Settings Data
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // Quiz Data
//   joinCode: string = '';
//   myQuizzes: Quiz[] = [];
//   newQuiz = { title: '', description: '' };

//   // Mock History Data (Replace with Real API later)
//   historyList: QuizHistory[] = [
//     { id: 1, quizTitle: 'Java Basics', score: 8, totalQuestions: 10, dateAttempted: '2025-11-20', status: 'Completed' },
//     { id: 2, quizTitle: 'React Fundamentals', score: 0, totalQuestions: 15, dateAttempted: '2025-11-21', status: 'Incomplete' }
//   ];

//   constructor(
//     private auth: AuthService, 
//     private router: Router,
//     private quizService: QuizService,
//     private userService: UserService
//   ) {}

//   ngOnInit(): void {
//     this.loadQuizzes();
//     this.loadUserProfile();

//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//     });
//   }

//   // --- VIEW NAVIGATION ---
//   switchView(view: 'dashboard' | 'library' | 'history' | 'settings') {
//     this.currentView = view;
//     window.scrollTo(0,0); // Scroll to top on switch
//   }

//   // --- API & LOGIC ---

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data) => {
//         this.currentUser = data;
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }
//       },
//       error: (err) => console.error('Failed to load profile', err)
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data) => this.myQuizzes = data,
//       error: (err) => console.error(err)
//     });
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   // --- ACTION METHODS ---

//   joinQuiz() {
//     if (!this.joinCode.trim()) { alert('Enter code!'); return; }
//     console.log('Join:', this.joinCode);
//     alert('Joining game... (Logic to be implemented)');
//   }

//   // Modal Triggers
//   openCreateModal() {
//     this.newQuiz = { title: '', description: '' }; 
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   openProfileModal() {
//     // Also switches to settings view for better UX
//     this.switchView('settings');
//   }

//   // Profile Actions
//   onProfileImageSelected(event: Event) {
//     const input = event.target as HTMLInputElement;
//     if (input.files && input.files[0]) {
//       this.selectedProfileImage = input.files[0];
//       const reader = new FileReader();
//       reader.onload = () => this.imagePreview = reader.result as string;
//       reader.readAsDataURL(this.selectedProfileImage);
//     }
//   }

//   updateProfile() {
//     const formData = new FormData();
//     formData.append('name', this.currentUser.name);
//     if (this.selectedProfileImage) {
//       formData.append('profileImage', this.selectedProfileImage);
//     }

//     this.userService.updateProfile(formData).subscribe({
//       next: () => {
//         alert('Profile updated successfully!');
//         this.loadUserProfile();
//       },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('New passwords do not match!');
//       return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => {
//         alert('Password changed successfully!');
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//       },
//       error: (err) => alert(err.error || 'Password change failed')
//     });
//   }

//   // Quiz Actions
//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
//     this.quizService.create(this.newQuiz.title, this.newQuiz.description).subscribe({
//         next: (q) => {
//             const el = document.getElementById('createQuizModal');
//             if (el) bootstrap.Modal.getInstance(el).hide();
//             this.switchView('library'); // Switch to library to see new quiz
//             alert(`Quiz Created! Code: ${q.code}`);
//         }
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Copied!'));
//   }

//   deleteQuiz(id: number) {
//     if(confirm('Delete?')) {
//         this.quizService.delete(id).subscribe();
//     }
//   }
// }