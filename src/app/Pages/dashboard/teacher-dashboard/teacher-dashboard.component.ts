import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/AuthService/auth.service';
import { QuizService } from '../../../core/services/QuizService/quiz.service';
import { UserService } from '../../../core/services/UserService/user.service';
import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
import { Quiz } from '../../../../../INTERFACE/quiz';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';

declare var bootstrap: any;

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.css'
})
export class TeacherDashboardComponent implements OnInit {
p: any;
// temporary debug helper you can remove later
debugOpenParticipant(p: any) {
  const candidate = p?.resolvedResultId || this.getResultId(p);
  console.log('DEBUG: participant row', p, 'resolvedId ->', candidate);
  if (!candidate || Number(candidate) <= 0) {
    alert('Missing result id for this participant. See console for the object.');
    return;
  }
  // call the real view method
  this.viewStudentAttempt(Number(candidate));
}

  // --- VIEW STATE ---
  currentView: 'dashboard' | 'exams' | 'reports' | 'settings' = 'dashboard';

  // --- USER & INSTITUTION DATA ---
  currentUser: any = { name: 'Faculty', email: '', institutionId: null, profileImageUrl: null };
  institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institution', instituteImage: null };
  
  // Settings Data
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  selectedProfileImage: File | null = null;
  imagePreview: string | null = null;

  // --- QUIZ DATA ---
  myQuizzes: any[] = []; 
  newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };

  // --- ANALYTICS DATA ---
  totalStudents = 0;
  pendingEvaluations = 0;
  
  selectedReportQuiz: string = '';
  reportParticipants: any[] = [];
  filteredParticipants: any[] = [];
  activeFilter: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW' = 'ALL';

  // --- INDIVIDUAL REVIEW DATA ---
  studentReview: any = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private userService: UserService,
    private quizService: QuizService,
    private institutionService: InstitutionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadQuizzes();
    
    this.quizService.refreshNeeded$.subscribe(() => {
      this.loadQuizzes();
    });
  }

  // ============================================================
  // 1. DATA LOADING & PROFILE
  // ============================================================

  loadUserProfile() {
    this.userService.getMe().subscribe({
      next: (data: any) => {
        this.currentUser = data || this.currentUser;
        
        // Fix Profile Image URL
        if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
          this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
        }

        if (this.currentUser.institutionId) {
          this.loadInstitutionDetails(this.currentUser.institutionId);
        }
      },
      error: (err) => console.error('Failed to load profile', err)
    });
  }

  loadInstitutionDetails(id: number) {
    this.institutionService.getInstituteById(id).subscribe({
      next: (data: InstitutionDataType) => {
        this.institutionDetails = data || this.institutionDetails;
        if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
          this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
        }
      },
      error: (err) => console.error('Failed to load institution details', err)
    });
  }

  loadQuizzes() {
    this.quizService.getAll().subscribe({
      next: (data: Quiz[]) => {
        // Map and parse description to extract hidden metadata (Time/Schedule)
        this.myQuizzes = (data || []).map(q => {
          const meta = this.parseDescription(q.description || '');
          return {
            ...q,
            status: q.active ? 'Active' : 'Draft',
            cleanDescription: meta.cleanDesc,
            timeLimit: meta.timeLimit,
            scheduledDate: meta.scheduledDate
          };
        });
        
        // Calculate total attempts across all quizzes (Mock logic)
        this.totalStudents = this.myQuizzes.length * 12; 
        this.pendingEvaluations = Math.floor(Math.random() * 5); 
      },
      error: () => console.error('Failed to load quizzes')
    });
  }

  parseDescription(desc: string) {
    if (!desc) return { cleanDesc: '', timeLimit: 60, scheduledDate: '' };
    
    let timeLimit = 60;
    let scheduledDate = '';
    
    const timeMatch = desc.match(/\[Time:(\d+)\]/);
    const dateMatch = desc.match(/\[Schedule:(.*?)\]/);

    if (timeMatch) timeLimit = parseInt(timeMatch[1]);
    if (dateMatch) scheduledDate = dateMatch[1];

    const cleanDesc = desc.replace(/\[Time:\d+\]/, '').replace(/\[Schedule:.*?\]/, '').trim();

    return { cleanDesc, timeLimit, scheduledDate };
  }

  // ============================================================
  // 2. QUIZ MANAGEMENT
  // ============================================================

  openCreateModal() {
    this.newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };
    const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
    modal.show();
  }

  createQuiz() {
    if (!this.newQuiz.title.trim()) return;
    let fullDescription = this.newQuiz.description || '';
    if (this.newQuiz.timeLimit) fullDescription += ` [Time:${this.newQuiz.timeLimit}]`;
    if (this.newQuiz.scheduledDate) fullDescription += ` [Schedule:${this.newQuiz.scheduledDate}]`;

    this.quizService.create(this.newQuiz.title, fullDescription).subscribe({
      next: (q) => {
        const el = document.getElementById('createQuizModal');
        if (el) bootstrap.Modal.getInstance(el).hide();
        this.switchView('exams');
        alert(`Exam Created! Access Code: ${q.code}`);
        this.loadQuizzes();
      },
      error: () => alert('Failed to create exam.')
    });
  }

  toggleQuizStatus(quiz: any) {
    const original = quiz.active;
    const newStatus = !original;

    quiz.active = newStatus;
    quiz.status = newStatus ? 'Active' : 'Inactive';

    this.quizService.updateStatus(quiz.id, newStatus).subscribe({
      next: (updatedQuiz) => {
        quiz.active = updatedQuiz.active;
        quiz.status = updatedQuiz.active ? 'Active' : 'Inactive';
        this.loadQuizzes();
      },
      error: (err) => {
        quiz.active = original;
        quiz.status = original ? 'Active' : 'Inactive';
        console.error('Failed to update quiz status', err);
        alert('Failed to update quiz status. Please try again.');
      }
    });
  }

  copyLink(code: string) {
    const link = `http://localhost:4200/play/${code}`;
    navigator.clipboard.writeText(link).then(() => alert('Exam Link copied to clipboard!'));
  }

  deleteQuiz(id: number) {
    if (confirm('Are you sure? This will delete the exam and all results.')) {
      this.quizService.delete(id).subscribe({
        next: () => this.loadQuizzes(),
        error: () => alert('Failed to delete quiz')
      });
    }
  }

  // ============================================================
  // 3. REPORTS & ANALYTICS
  // ============================================================

  /**
   * Attempts to extract a meaningful numeric result id from participant row `p`.
   * Tries many common fields and nested shapes.
   */
  private resolveResultId(p: any): number | null {
    if (!p) return null;

    // candidate field names / nested shapes to try (order matters)
    const candidates: any[] = [
      p.id, p.resultId, p.quizResultId, p.attemptId, p.quizAttemptId, p.result_id,
      // nested objects
      p.result?.id, p.quizResult?.id, p.attempt?.id, p.result?.resultId, p.result?.quizResultId,
      // some backends may use participant.result?.id or similar
      p.participantResultId, p.quiz_result_id
    ];

    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      // strings that contain numbers
      if (typeof c === 'string') {
        const trimmed = c.trim();
        if (trimmed === '') continue;
        const n = Number(trimmed);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
        // non-numeric string — skip
        continue;
      }
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
        return Math.floor(c);
      }
    }

    return null;
  }

  // openReportModal(quizId: number, quizTitle: string) {
  //   this.selectedReportQuiz = quizTitle;
  //   this.activeFilter = 'ALL';
  //   this.filteredParticipants = [];

  //   this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
  //     next: (data) => {
  //       // raw debug log to inspect the backend payload structure
  //       console.debug('reportParticipants raw:', data);

  //       // Normalize: make sure each participant has a `resolvedResultId` property we can rely on
  //       this.reportParticipants = (data || []).map((p, idx) => {
  //         const resolvedResultId = this.resolveResultId(p);
  //         return { ...p, resolvedResultId, _debugIndex: idx };
  //       });

  //       console.debug('reportParticipants normalized:', this.reportParticipants);

  //       this.filteredParticipants = [...this.reportParticipants];
  //       const modal = new bootstrap.Modal(document.getElementById('reportModal'));
  //       modal.show();
  //     },
  //     error: (err) => {
  //       console.error('Failed to load report data', err);
  //       alert('Failed to load report data. Check backend logs/permissions.');
  //     }
  //   });
  // }

  openReportModal(quizId: number, quizTitle: string) {
  this.selectedReportQuiz = quizTitle;
  this.activeFilter = 'ALL';
  this.filteredParticipants = [];

  this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
    next: (data) => {
      console.debug('reportParticipants raw payload:', data);

      // Normalize: resolvedResultId will be numeric > 0 or null
      this.reportParticipants = (data || []).map((p, idx) => {
        const resolvedResultId = this.resolveResultId(p); // you already have resolveResultId helper
        return { ...p, resolvedResultId, _debugIndex: idx };
      });

      console.debug('reportParticipants normalized:', this.reportParticipants);

      // expose to filtered list (template will show buttons enabled for rows where resolvedResultId exists)
      this.filteredParticipants = [...this.reportParticipants];

      // Show the modal after change-detection has a chance to render the normalized data.
      // This avoids timing issues where bootstrap toggles aria-hidden before the DOM has the new buttons.
      const el = document.getElementById('reportModal');
      if (!el) {
        console.error('reportModal element not found in DOM');
        return;
      }

      // small tick to allow Angular to apply the updated filteredParticipants bindings
      setTimeout(() => {
        // Bootstrap 5: getOrCreateInstance is safest; fall back to constructor if not available
        try {
          // prefer getOrCreateInstance if available
          // @ts-ignore
          const modal = (bootstrap.Modal && bootstrap.Modal.getOrCreateInstance)
            ? // @ts-ignore
              bootstrap.Modal.getOrCreateInstance(el)
            : new bootstrap.Modal(el);
          modal.show();
          // debug state
          console.debug('Report modal shown via bootstrap');
        } catch (err) {
          console.error('Failed to show report modal', err);
        }
      }, 0);
    },
    error: (err) => {
      console.error('Failed to load report data', err);
      alert('Failed to load report data. Check backend logs/permissions.');
    }
  });
}


  applyFilter(type: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW') {
    this.activeFilter = type;
    let data = [...this.reportParticipants];

    switch (type) {
      case 'ALL': this.filteredParticipants = data; break;
      case 'PASS': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) >= 0.5); break;
      case 'FAIL': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) < 0.5); break;
      case 'TOP': this.filteredParticipants = data.sort((a, b) => b.score - a.score); break;
      case 'LOW': this.filteredParticipants = data.sort((a, b) => a.score - b.score); break;
    }
  }

  // ============================================================
  // 4. INDIVIDUAL STUDENT REVIEW
  // ============================================================

  // viewStudentAttempt(quizResultId: number | null | undefined) {
  //   // Guard against missing/invalid id - don't call backend with 0/undefined/null
  //   if (!quizResultId || Number(quizResultId) <= 0) {
  //     console.warn('Attempt to view student attempt without a valid quizResultId:', quizResultId);
  //     alert('Cannot open review — missing result id. Confirm backend returns a result id for this participant.');
  //     return;
  //   }

  //   this.http.get<any>(`http://localhost:8080/api/results/review/${quizResultId}`).subscribe({
  //       next: (data) => {
  //           this.studentReview = data;
  //           const modal = new bootstrap.Modal(document.getElementById('studentReviewModal'));
  //           modal.show();
  //       },
  //       error: (err) => {
  //           console.error('Failed to load student review', err);
  //           if (err && err.status === 404) {
  //             alert('Student attempt not found (404). The requested result id may not exist or you do not have permission.');
  //           } else if (err && err.status === 403) {
  //             alert('Access denied (403). Ensure the teacher account has permission to view result details.');
  //           } else {
  //             alert('Could not load student details. Ensure backend permissions are set and check server logs.');
  //           }
  //       }
  //   });
  // }


  viewStudentAttempt(quizResultId: number | null | undefined) {
  if (!quizResultId || Number(quizResultId) <= 0) {
    console.warn('Attempt to view student attempt without a valid quizResultId:', quizResultId);
    alert('Cannot open review — missing or invalid result id. Confirm backend returns a numeric result id for this participant.');
    return;
  }

  // show a loading indicator in console (you can extend to UI spinner)
  console.debug('Requesting review for id:', quizResultId);

  this.http.get<any>(`http://localhost:8080/api/results/review/${quizResultId}`).subscribe({
    next: (data) => {
      this.studentReview = data;
      // Show review modal (same safe pattern)
      const el = document.getElementById('studentReviewModal');
      if (!el) {
        console.error('studentReviewModal element not found in DOM');
        return;
      }
      try {
        // @ts-ignore
        const modal = (bootstrap.Modal && bootstrap.Modal.getOrCreateInstance)
          ? // @ts-ignore
            bootstrap.Modal.getOrCreateInstance(el)
          : new bootstrap.Modal(el);
        setTimeout(() => modal.show(), 0);
      } catch (err) {
        console.error('Failed to show student review modal', err);
      }
    },
    error: (err) => {
      console.error('Failed to load student review', err);
      if (err && err.status === 404) {
        alert('Student attempt not found (404). The requested result id may not exist or you do not have permission.');
      } else if (err && err.status === 403) {
        alert('Access denied (403). Ensure the teacher account has permission to view result details.');
      } else {
        alert('Could not load student details. Ensure backend permissions are set and check server logs.');
      }
    }
  });
}


  // ============================================================
  // 5. SETTINGS & UTILS
  // ============================================================

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
      next: () => { alert('Profile saved!'); this.loadUserProfile(); },
      error: () => alert('Update failed')
    });
  }

  changePassword() {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('Passwords do not match!'); return;
    }
    this.userService.changePassword(this.passwordData).subscribe({
      next: () => { 
        alert('Password changed!'); 
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' }; 
      },
      error: (err) => alert(err.error || 'Failed')
    });
  }

  getPercentage(score: number, total: number): number {
    return total === 0 ? 0 : Math.round((score / total) * 100);
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
    if (!name || name.length === 0) return 'bg-primary';
    return colors[name.charCodeAt(0) % colors.length];
  }

  switchView(view: any) {
    this.currentView = view;
    window.scrollTo(0, 0);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  /** Return resolvedResultId previously set on normalized participants (safe accessor used by template) */
  getResultId(p: any): number | null {
    if (!p) return null;
    // If normalized property present use it; otherwise fallback to resolving on the fly
    if (p.resolvedResultId && typeof p.resolvedResultId === 'number' && p.resolvedResultId > 0) return p.resolvedResultId;
    return this.resolveResultId(p);
  }

}








// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-teacher-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './teacher-dashboard.component.html',
//   styleUrl: './teacher-dashboard.component.css'
// })
// export class TeacherDashboardComponent implements OnInit {

// // --- VIEW STATE ---
//   currentView: 'dashboard' | 'exams' | 'reports' | 'settings' = 'dashboard';

//   // --- USER & INSTITUTION DATA ---
//   currentUser: any = { name: 'Faculty', email: '', institutionId: null, profileImageUrl: null };
//   institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institution', instituteImage: null };
  
//   // Settings Data
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // --- QUIZ DATA ---
//   myQuizzes: any[] = []; 
//   newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };

//   // --- ANALYTICS DATA ---
//   totalStudents = 0;
//   pendingEvaluations = 0;
  
//   selectedReportQuiz: string = '';
//   reportParticipants: any[] = [];
//   filteredParticipants: any[] = [];
//   activeFilter: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW' = 'ALL';

//   // --- INDIVIDUAL REVIEW DATA ---
//   studentReview: any = null;

//   constructor(
//     private auth: AuthService,
//     private router: Router,
//     private userService: UserService,
//     private quizService: QuizService,
//     private institutionService: InstitutionService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadQuizzes();
    
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//     });
//   }

//   // ============================================================
//   // 1. DATA LOADING & PROFILE
//   // ============================================================

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data: any) => {
//         this.currentUser = data || this.currentUser;
        
//         // Fix Profile Image URL
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }

//         if (this.currentUser.institutionId) {
//           this.loadInstitutionDetails(this.currentUser.institutionId);
//         }
//       },
//       error: (err) => console.error('Failed to load profile', err)
//     });
//   }

//   loadInstitutionDetails(id: number) {
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data: InstitutionDataType) => {
//         this.institutionDetails = data || this.institutionDetails;
//         if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       },
//       error: (err) => console.error('Failed to load institution details', err)
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data: Quiz[]) => {
//         // Map and parse description to extract hidden metadata (Time/Schedule)
//         this.myQuizzes = (data || []).map(q => {
//           const meta = this.parseDescription(q.description || '');
//           return {
//             ...q,
//             status: q.active ? 'Active' : 'Draft',
//             cleanDescription: meta.cleanDesc,
//             timeLimit: meta.timeLimit,
//             scheduledDate: meta.scheduledDate
//           };
//         });
        
//         // Calculate total attempts across all quizzes (Mock logic)
//         this.totalStudents = this.myQuizzes.length * 12; 
//         this.pendingEvaluations = Math.floor(Math.random() * 5); 
//       },
//       error: () => console.error('Failed to load quizzes')
//     });
//   }

//   parseDescription(desc: string) {
//     if (!desc) return { cleanDesc: '', timeLimit: 60, scheduledDate: '' };
    
//     let timeLimit = 60;
//     let scheduledDate = '';
    
//     const timeMatch = desc.match(/\[Time:(\d+)\]/);
//     const dateMatch = desc.match(/\[Schedule:(.*?)\]/);

//     if (timeMatch) timeLimit = parseInt(timeMatch[1]);
//     if (dateMatch) scheduledDate = dateMatch[1];

//     const cleanDesc = desc.replace(/\[Time:\d+\]/, '').replace(/\[Schedule:.*?\]/, '').trim();

//     return { cleanDesc, timeLimit, scheduledDate };
//   }

//   // ============================================================
//   // 2. QUIZ MANAGEMENT
//   // ============================================================

//   openCreateModal() {
//     this.newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
//     let fullDescription = this.newQuiz.description || '';
//     if (this.newQuiz.timeLimit) fullDescription += ` [Time:${this.newQuiz.timeLimit}]`;
//     if (this.newQuiz.scheduledDate) fullDescription += ` [Schedule:${this.newQuiz.scheduledDate}]`;

//     this.quizService.create(this.newQuiz.title, fullDescription).subscribe({
//       next: (q) => {
//         const el = document.getElementById('createQuizModal');
//         if (el) bootstrap.Modal.getInstance(el).hide();
//         this.switchView('exams');
//         alert(`Exam Created! Access Code: ${q.code}`);
//         this.loadQuizzes();
//       },
//       error: () => alert('Failed to create exam.')
//     });
//   }

//   toggleQuizStatus(quiz: any) {
//     const original = quiz.active;
//     const newStatus = !original;

//     quiz.active = newStatus;
//     quiz.status = newStatus ? 'Active' : 'Inactive';

//     this.quizService.updateStatus(quiz.id, newStatus).subscribe({
//       next: (updatedQuiz) => {
//         quiz.active = updatedQuiz.active;
//         quiz.status = updatedQuiz.active ? 'Active' : 'Inactive';
//         this.loadQuizzes();
//       },
//       error: (err) => {
//         quiz.active = original;
//         quiz.status = original ? 'Active' : 'Inactive';
//         console.error('Failed to update quiz status', err);
//         alert('Failed to update quiz status. Please try again.');
//       }
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam Link copied to clipboard!'));
//   }

//   deleteQuiz(id: number) {
//     if (confirm('Are you sure? This will delete the exam and all results.')) {
//       this.quizService.delete(id).subscribe({
//         next: () => this.loadQuizzes(),
//         error: () => alert('Failed to delete quiz')
//       });
//     }
//   }

//   // ============================================================
//   // 3. REPORTS & ANALYTICS
//   // ============================================================

//   openReportModal(quizId: number, quizTitle: string) {
//     this.selectedReportQuiz = quizTitle;
//     this.activeFilter = 'ALL';
//     this.filteredParticipants = [];

//     this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
//       next: (data) => {
//         // Normalize: make sure each participant has an `id` property we can rely on
//         this.reportParticipants = (data || []).map((p, idx) => {
//           const normalizedId = p?.id || p?.resultId || p?.quizResultId || p?.attemptId || null;
//           return { ...p, id: normalizedId, _debugIndex: idx };
//         });

//         console.debug('reportParticipants (normalized):', this.reportParticipants);
//         this.filteredParticipants = [...this.reportParticipants];
//         const modal = new bootstrap.Modal(document.getElementById('reportModal'));
//         modal.show();
//       },
//       error: (err) => {
//         console.error('Failed to load report data', err);
//         alert('Failed to load report data. Check backend logs/permissions.');
//       }
//     });
//   }

//   applyFilter(type: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW') {
//     this.activeFilter = type;
//     let data = [...this.reportParticipants];

//     switch (type) {
//       case 'ALL': this.filteredParticipants = data; break;
//       case 'PASS': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) >= 0.5); break;
//       case 'FAIL': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) < 0.5); break;
//       case 'TOP': this.filteredParticipants = data.sort((a, b) => b.score - a.score); break;
//       case 'LOW': this.filteredParticipants = data.sort((a, b) => a.score - b.score); break;
//     }
//   }

//   // ============================================================
//   // 4. INDIVIDUAL STUDENT REVIEW
//   // ============================================================

//   viewStudentAttempt(quizResultId: number | null | undefined) {
//     // Guard against missing/invalid id - don't call backend with 0/undefined/null
//     if (!quizResultId || Number(quizResultId) <= 0) {
//       console.warn('Attempt to view student attempt without a valid quizResultId:', quizResultId);
//       alert('Cannot open review — missing result id. Confirm backend returns a result id for this participant.');
//       return;
//     }

//     this.http.get<any>(`http://localhost:8080/api/results/review/${quizResultId}`).subscribe({
//         next: (data) => {
//             this.studentReview = data;
//             const modal = new bootstrap.Modal(document.getElementById('studentReviewModal'));
//             modal.show();
//         },
//         error: (err) => {
//             console.error('Failed to load student review', err);
//             if (err && err.status === 404) {
//               alert('Student attempt not found (404). The requested result id may not exist or you do not have permission.');
//             } else if (err && err.status === 403) {
//               alert('Access denied (403). Ensure the teacher account has permission to view result details.');
//             } else {
//               alert('Could not load student details. Ensure backend permissions are set and check server logs.');
//             }
//         }
//     });
//   }

//   // ============================================================
//   // 5. SETTINGS & UTILS
//   // ============================================================

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
//       next: () => { alert('Profile saved!'); this.loadUserProfile(); },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match!'); return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => { 
//         alert('Password changed!'); 
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' }; 
//       },
//       error: (err) => alert(err.error || 'Failed')
//     });
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     if (!name || name.length === 0) return 'bg-primary';
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   switchView(view: any) {
//     this.currentView = view;
//     window.scrollTo(0, 0);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }

//   /** return first available id from participant */
// getResultId(p: any): number | null {
//   if (!p) return null;
//   // common backend field names we try, add others if needed
//   const candidate = p.id ?? p.resultId ?? p.quizResultId ?? p.attemptId ?? p.quizAttemptId;
//   // if backend provides a string id, attempt to parse to number
//   if (typeof candidate === 'string' && candidate.trim() !== '') {
//     const n = Number(candidate);
//     return Number.isFinite(n) ? n : null;
//   }
//   return (typeof candidate === 'number' && candidate > 0) ? candidate : null;
// }

// }





// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-teacher-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './teacher-dashboard.component.html',
//   styleUrl: './teacher-dashboard.component.css'
// })
// export class TeacherDashboardComponent implements OnInit {

// // --- VIEW STATE ---
//   currentView: 'dashboard' | 'exams' | 'reports' | 'settings' = 'dashboard';

//   // --- USER & INSTITUTION DATA ---
//   currentUser: any = { name: 'Faculty', email: '', institutionId: null, profileImageUrl: null };
//   institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institution', instituteImage: null };
  
//   // Settings Data
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // --- QUIZ DATA ---
//   myQuizzes: any[] = []; 
//   newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };

//   // --- ANALYTICS DATA ---
//   totalStudents = 0;
//   pendingEvaluations = 0;
  
//   selectedReportQuiz: string = '';
//   reportParticipants: any[] = [];
//   filteredParticipants: any[] = [];
//   activeFilter: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW' = 'ALL';

//   // --- INDIVIDUAL REVIEW DATA ---
//   studentReview: any = null;

//   constructor(
//     private auth: AuthService,
//     private router: Router,
//     private userService: UserService,
//     private quizService: QuizService,
//     private institutionService: InstitutionService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadQuizzes();
    
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//     });
//   }

//   // ============================================================
//   // 1. DATA LOADING & PROFILE
//   // ============================================================

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data: any) => {
//         this.currentUser = data;
        
//         // Fix Profile Image URL
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }

//         if (this.currentUser.institutionId) {
//           this.loadInstitutionDetails(this.currentUser.institutionId);
//         }
//       },
//       error: (err) => console.error('Failed to load profile', err)
//     });
//   }

//   loadInstitutionDetails(id: number) {
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data: InstitutionDataType) => {
//         this.institutionDetails = data;
//         if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       }
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data: Quiz[]) => {
//         // Map and parse description to extract hidden metadata (Time/Schedule)
//         this.myQuizzes = data.map(q => {
//           // ✅ FIX: Handle potential undefined description with || ''
//           const meta = this.parseDescription(q.description || '');
//           return {
//             ...q,
//             status: q.active ? 'Active' : 'Draft',
//             cleanDescription: meta.cleanDesc,
//             timeLimit: meta.timeLimit,
//             scheduledDate: meta.scheduledDate
//           };
//         });
        
//         // Calculate total attempts across all quizzes (Mock logic)
//         this.totalStudents = this.myQuizzes.length * 12; 
//         this.pendingEvaluations = Math.floor(Math.random() * 5); 
//       },
//       error: () => console.error('Failed to load quizzes')
//     });
//   }

//   // Helper: Extracts [Time:60] [Schedule:2023-01-01] tags from description
//   parseDescription(desc: string) {
//     if (!desc) return { cleanDesc: '', timeLimit: 60, scheduledDate: '' };
    
//     let timeLimit = 60;
//     let scheduledDate = '';
    
//     const timeMatch = desc.match(/\[Time:(\d+)\]/);
//     const dateMatch = desc.match(/\[Schedule:(.*?)\]/);

//     if (timeMatch) timeLimit = parseInt(timeMatch[1]);
//     if (dateMatch) scheduledDate = dateMatch[1];

//     // Remove tags for clean UI display
//     const cleanDesc = desc.replace(/\[Time:\d+\]/, '').replace(/\[Schedule:.*?\]/, '').trim();

//     return { cleanDesc, timeLimit, scheduledDate };
//   }

//   // ============================================================
//   // 2. QUIZ MANAGEMENT
//   // ============================================================

//   openCreateModal() {
//     this.newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
    
//     // Pack meta-data into description string
//     let fullDescription = this.newQuiz.description;
//     if (this.newQuiz.timeLimit) fullDescription += ` [Time:${this.newQuiz.timeLimit}]`;
//     if (this.newQuiz.scheduledDate) fullDescription += ` [Schedule:${this.newQuiz.scheduledDate}]`;

//     this.quizService.create(this.newQuiz.title, fullDescription).subscribe({
//       next: (q) => {
//         const el = document.getElementById('createQuizModal');
//         if (el) bootstrap.Modal.getInstance(el).hide();
//         this.switchView('exams');
//         alert(`Exam Created! Access Code: ${q.code}`);
//         this.loadQuizzes();
//       },
//       error: () => alert('Failed to create exam.')
//     });
//   }

//   // ✅ FIXED: Persist status change to backend and refresh
//   toggleQuizStatus(quiz: any) {
//     const original = quiz.active;
//     const newStatus = !original;

//     // Optimistic UI update
//     quiz.active = newStatus;
//     quiz.status = newStatus ? 'Active' : 'Inactive';

//     this.quizService.updateStatus(quiz.id, newStatus).subscribe({
//       next: (updatedQuiz) => {
//         // ensure local list syncs to backend response
//         quiz.active = updatedQuiz.active;
//         quiz.status = updatedQuiz.active ? 'Active' : 'Inactive';
//         // optionally reload list from server for consistency
//         this.loadQuizzes();
//       },
//       error: (err) => {
//         // rollback on failure
//         quiz.active = original;
//         quiz.status = original ? 'Active' : 'Inactive';
//         console.error('Failed to update quiz status', err);
//         alert('Failed to update quiz status. Please try again.');
//       }
//     });
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam Link copied to clipboard!'));
//   }

//   deleteQuiz(id: number) {
//     if (confirm('Are you sure? This will delete the exam and all results.')) {
//       this.quizService.delete(id).subscribe({
//         next: () => this.loadQuizzes(),
//         error: () => alert('Failed to delete quiz')
//       });
//     }
//   }

//   // ============================================================
//   // 3. REPORTS & ANALYTICS
//   // ============================================================

//   openReportModal(quizId: number, quizTitle: string) {
//     this.selectedReportQuiz = quizTitle;
//     this.activeFilter = 'ALL';
//     this.filteredParticipants = [];

//     this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
//       next: (data) => {
//         this.reportParticipants = data;
//         this.filteredParticipants = data;
//         const modal = new bootstrap.Modal(document.getElementById('reportModal'));
//         modal.show();
//       },
//       error: () => alert('Failed to load report data.')
//     });
//   }

//   applyFilter(type: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW') {
//     this.activeFilter = type;
//     let data = [...this.reportParticipants];

//     switch (type) {
//       case 'ALL': this.filteredParticipants = data; break;
//       case 'PASS': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) >= 0.5); break;
//       case 'FAIL': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) < 0.5); break;
//       case 'TOP': this.filteredParticipants = data.sort((a, b) => b.score - a.score); break;
//       case 'LOW': this.filteredParticipants = data.sort((a, b) => a.score - b.score); break;
//     }
//   }

//   // ============================================================
//   // 4. INDIVIDUAL STUDENT REVIEW
//   // ============================================================

//   viewStudentAttempt(quizResultId: number) {
//     this.http.get<any>(`http://localhost:8080/api/results/review/${quizResultId}`).subscribe({
//         next: (data) => {
//             this.studentReview = data;
//             const modal = new bootstrap.Modal(document.getElementById('studentReviewModal'));
//             modal.show();
//         },
//         error: (err) => {
//             console.error(err);
//             alert("Could not load student details. Ensure backend permissions are set.");
//         }
//     });
//   }

//   // ============================================================
//   // 5. SETTINGS & UTILS
//   // ============================================================

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
//       next: () => { alert('Profile saved!'); this.loadUserProfile(); },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match!'); return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => { 
//         alert('Password changed!'); 
//         this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' }; 
//       },
//       error: (err) => alert(err.error || 'Failed')
//     });
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   switchView(view: any) {
//     this.currentView = view;
//     window.scrollTo(0, 0);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }
// }

// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router, RouterLink } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { AuthService } from '../../../core/services/AuthService/auth.service';
// import { QuizService } from '../../../core/services/QuizService/quiz.service';
// import { UserService } from '../../../core/services/UserService/user.service';
// import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
// import { Quiz } from '../../../../../INTERFACE/quiz';
// import { InstitutionDataType } from '../../../../../INTERFACE/institution';

// declare var bootstrap: any;

// @Component({
//   selector: 'app-teacher-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, RouterLink],
//   templateUrl: './teacher-dashboard.component.html',
//   styleUrl: './teacher-dashboard.component.css'
// })
// export class TeacherDashboardComponent implements OnInit {

//   // --- VIEW STATE ---
//   currentView: 'dashboard' | 'exams' | 'reports' | 'settings' = 'dashboard';

//   // --- USER & INSTITUTION DATA ---
//   currentUser: any = { name: 'Faculty', email: '', institutionId: null, profileImageUrl: null };
//   institutionDetails: InstitutionDataType = { id: 0, instituteName: 'My Institution', instituteImage: null };
  
//   // Settings Data
//   passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
//   selectedProfileImage: File | null = null;
//   imagePreview: string | null = null;

//   // --- QUIZ DATA ---
//   myQuizzes: any[] = []; // Using any to support UI-specific fields like 'status'
//   newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' }; // Added timeLimit & schedule

//   // --- ANALYTICS DATA ---
//   totalStudents = 0;
//   pendingEvaluations = 0;
  
//   selectedReportQuiz: string = '';
//   reportParticipants: any[] = [];
//   filteredParticipants: any[] = [];
//   activeFilter: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW' = 'ALL';

//   // --- INDIVIDUAL REVIEW DATA ---
//   studentReview: any = null;

//   constructor(
//     private auth: AuthService,
//     private router: Router,
//     private userService: UserService,
//     private quizService: QuizService,
//     private institutionService: InstitutionService,
//     private http: HttpClient
//   ) {}

//   ngOnInit(): void {
//     this.loadUserProfile();
//     this.loadQuizzes();
    
//     // Auto-refresh listener
//     this.quizService.refreshNeeded$.subscribe(() => {
//       this.loadQuizzes();
//     });
//   }

//   // ============================================================
//   // 1. DATA LOADING & PROFILE
//   // ============================================================

//   loadUserProfile() {
//     this.userService.getMe().subscribe({
//       next: (data: any) => {
//         this.currentUser = data;
//         if (this.currentUser.profileImageUrl && !this.currentUser.profileImageUrl.startsWith('http')) {
//           this.currentUser.profileImageUrl = 'http://localhost:8080/' + this.currentUser.profileImageUrl;
//         }
//         if (this.currentUser.institutionId) {
//           this.loadInstitutionDetails(this.currentUser.institutionId);
//         }
//       },
//       error: (err) => console.error('Failed to load profile', err)
//     });
//   }

//   loadInstitutionDetails(id: number) {
//     this.institutionService.getInstituteById(id).subscribe({
//       next: (data: InstitutionDataType) => {
//         this.institutionDetails = data;
//         if (this.institutionDetails.instituteImage && !this.institutionDetails.instituteImage.startsWith('http')) {
//           this.institutionDetails.instituteImage = 'http://localhost:8080/' + this.institutionDetails.instituteImage;
//         }
//       }
//     });
//   }

//   loadQuizzes() {
//     this.quizService.getAll().subscribe({
//       next: (data: Quiz[]) => {
//         this.myQuizzes = data.map(q => ({
//           ...q,
//           status: q.active ? 'Active' : 'Draft', // Map boolean to string for UI
//           timeLimit: 60 // Default or fetch from description if stored there
//         }));
//         // Mock stats calculation
//         this.totalStudents = data.length * 15; 
//         this.pendingEvaluations = Math.floor(Math.random() * 5); 
//       },
//       error: () => console.error('Failed to load quizzes')
//     });
//   }

//   // ============================================================
//   // 2. QUIZ MANAGEMENT (Create, Toggle, Delete)
//   // ============================================================

//   openCreateModal() {
//     this.newQuiz = { title: '', description: '', timeLimit: 60, scheduledDate: '' };
//     const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
//     modal.show();
//   }

//   createQuiz() {
//     if (!this.newQuiz.title.trim()) return;
    
//     // Append meta-data to description since backend might not have specific fields yet
//     const fullDescription = `${this.newQuiz.description} | Time: ${this.newQuiz.timeLimit}m | Schedule: ${this.newQuiz.scheduledDate}`;

//     this.quizService.create(this.newQuiz.title, fullDescription).subscribe({
//       next: (q) => {
//         const el = document.getElementById('createQuizModal');
//         if (el) bootstrap.Modal.getInstance(el).hide();
//         this.switchView('exams');
//         alert(`Exam Created! Code: ${q.code}`);
//         this.loadQuizzes();
//       },
//       error: () => alert('Failed to create exam.')
//     });
//   }

//   toggleQuizStatus(quiz: any) {
//     // Toggle local state immediately for UI responsiveness
//     quiz.active = !quiz.active;
//     quiz.status = quiz.active ? 'Active' : 'Inactive';
    
//     // In a real app, call: this.quizService.updateStatus(quiz.id, quiz.active).subscribe();
//     // Here we simulate the save
//     console.log(`Quiz ${quiz.id} status changed to ${quiz.active}`);
//   }

//   copyLink(code: string) {
//     const link = `http://localhost:4200/play/${code}`;
//     navigator.clipboard.writeText(link).then(() => alert('Exam Link copied!'));
//   }

//   deleteQuiz(id: number) {
//     if (confirm('Are you sure? All student result data for this exam will be lost.')) {
//       this.quizService.delete(id).subscribe({
//         next: () => this.loadQuizzes(),
//         error: () => alert('Failed to delete quiz')
//       });
//     }
//   }

//   // ============================================================
//   // 3. REPORTS & ANALYTICS
//   // ============================================================

//   openReportModal(quizId: number, quizTitle: string) {
//     this.selectedReportQuiz = quizTitle;
//     this.activeFilter = 'ALL';
//     this.filteredParticipants = [];

//     this.http.get<any[]>(`http://localhost:8080/api/results/participants/${quizId}`).subscribe({
//       next: (data) => {
//         this.reportParticipants = data;
//         this.filteredParticipants = data;
//         const modal = new bootstrap.Modal(document.getElementById('reportModal'));
//         modal.show();
//       },
//       error: () => alert('Failed to load report data.')
//     });
//   }

//   // Filters the gradebook table
//   applyFilter(type: 'ALL' | 'PASS' | 'FAIL' | 'TOP' | 'LOW') {
//     this.activeFilter = type;
//     let data = [...this.reportParticipants];

//     switch (type) {
//       case 'ALL': this.filteredParticipants = data; break;
//       case 'PASS': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) >= 0.5); break;
//       case 'FAIL': this.filteredParticipants = data.filter(p => (p.score / p.totalQuestions) < 0.5); break;
//       case 'TOP': this.filteredParticipants = data.sort((a, b) => b.score - a.score); break;
//       case 'LOW': this.filteredParticipants = data.sort((a, b) => a.score - b.score); break;
//     }
//   }

//   // ============================================================
//   // 4. INDIVIDUAL STUDENT REVIEW
//   // ============================================================

//   viewStudentAttempt(resultId: number) {
//     // Fetch detailed review for this specific student result
//     this.http.get<any>(`http://localhost:8080/api/results/review/${resultId}`).subscribe({
//         next: (data) => {
//             this.studentReview = data;
//             // Open the nested modal
//             const modal = new bootstrap.Modal(document.getElementById('studentReviewModal'));
//             modal.show();
//         },
//         error: (err) => alert("Could not load student details. " + (err.error || "Server Error"))
//     });
//   }

//   // ============================================================
//   // 5. SETTINGS & UTILS
//   // ============================================================

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
//       next: () => { alert('Profile saved!'); this.loadUserProfile(); },
//       error: () => alert('Update failed')
//     });
//   }

//   changePassword() {
//     if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
//       alert('Passwords do not match!'); return;
//     }
//     this.userService.changePassword(this.passwordData).subscribe({
//       next: () => { alert('Password changed!'); this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' }; },
//       error: (err) => alert(err.error || 'Failed')
//     });
//   }

//   getPercentage(score: number, total: number): number {
//     return total === 0 ? 0 : Math.round((score / total) * 100);
//   }

//   getAvatarColor(name: string): string {
//     const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-dark'];
//     return colors[name.charCodeAt(0) % colors.length];
//   }

//   switchView(view: any) {
//     this.currentView = view;
//     window.scrollTo(0, 0);
//   }

//   logout() {
//     this.auth.logout();
//     this.router.navigate(['/home']);
//   }
// }