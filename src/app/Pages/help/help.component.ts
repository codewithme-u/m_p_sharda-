import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';

@Component({
  selector: 'app-help',
  imports: [FormsModule, CommonModule],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css'
})
export class HelpComponent {
  faqs = [
    {
      question: 'How does Face & Eye Authentication ensure security?',
      answer: 'The platform utilizes real-time facial recognition and AI-powered eye-tracking to monitor user focus, ensuring that only the authenticated individual is actively attempting the test.'
    },
    {
      question: 'What if the system doesn’t recognize my face?',
      answer: 'Ensure proper lighting and sit directly in front of the camera. The system provides retry options if recognition fails. Persistent issues can be reported via the contact form below.'
    },
    {
      question: 'How are my personal details secured?',
      answer: 'We use JSON Web Tokens (JWT) for secure API communication, and all data is encrypted following industry-grade security protocols.'
    },
    {
      question: 'Can faculty create custom quizzes?',
      answer: 'Yes. Authorized faculty can log in to the institution dashboard, create quizzes, set question types, control access levels, and enable secure proctoring options.'
    },
    {
      question: 'Is mobile access supported?',
      answer: 'While the system is responsive, we recommend desktops or laptops for full proctoring capabilities using the webcam.'
    }
  ];

}
