import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-remote-proctoring',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './remote-proctoring.component.html',
  styleUrls: ['./remote-proctoring.component.css']
})
export class RemoteProctoringComponent {
  features = [
    {
      title: 'Secure Login with JWT & OAuth',
      description: 'Robust access control using JWT & OAuth protocols. Ensures seamless login with strong encryption for individuals and institutions.',
      image: 'https://plus.unsplash.com/premium_photo-1681487746049-c39357159f69?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Face & Eye Tracking Authentication',
      description: 'Biometric verification with real-time facial and eye detection to prevent impersonation and ensure candidate authenticity.',
      image: 'https://plus.unsplash.com/premium_photo-1734171012738-0e4781a57b12?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Role-Based Quiz Creation',
      description: 'Faculty and Admins enjoy structured control with role-based quiz management for targeted learning and assessment.',
      image: 'https://images.unsplash.com/photo-1505238680356-667803448bb6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Real-Time Video Monitoring',
      description: 'AI & human proctors monitor candidates live to detect suspicious behavior, ensuring a secure exam environment.',
      image: 'https://images.unsplash.com/photo-1614588876378-b2ffa4520c22?q=80&w=2060&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Auto Evaluation & Instant Feedback',
      description: 'Objective answers are auto-evaluated with real-time result delivery, boosting transparency and learning feedback.',
      image: 'https://plus.unsplash.com/premium_photo-1677093906033-dc2beb53ace3?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Premium Institution Access',
      description: 'Get premium features like deep analytics, branding, priority support, and secure integrations built for scale.',
      image: 'https://plus.unsplash.com/premium_photo-1674669009418-2643aa58b11b?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
      title: 'Rich Dashboards & Reports',
      description: 'Visualize quiz performance and activity logs with exportable, audit-ready dashboards tailored for institutions.',
      image: 'https://plus.unsplash.com/premium_photo-1720556221767-990b2e11807c?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    }
  ];
}
