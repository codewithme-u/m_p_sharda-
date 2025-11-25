// src/app/Pages/auth/institution-users/institution-selector/institution-selector.component.ts
import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { InstitutionDataType } from '../../../../../../INTERFACE/institution';
import { InstitutionService } from '../../../../core/services/InstitutionService/institution.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-institution-selector',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './institution-selector.component.html',
  styleUrls: ['./institution-selector.component.css']
})
export class InstitutionSelectionComponent implements OnInit {

  public institutions: InstitutionDataType[] = [];
  public filteredInstitutions: InstitutionDataType[] = [];
  public searchText = '';
  public selectedInstitution: InstitutionDataType | null = null;
  public showLoginSuccess = false;

  public loginData = {
    userId: '',
    password: ''
  };

  @Output() public institutionSelected = new EventEmitter<InstitutionDataType | null>();

  constructor(private institutionService: InstitutionService, private router: Router) {}

  public ngOnInit(): void {
    this.fetchInstitutions();
  }

  public fetchInstitutions(): void {
    this.institutionService.getInstitutionList().subscribe({
      next: (data: InstitutionDataType[]) => {
        this.institutions = data || [];
        this.filteredInstitutions = [...this.institutions];
      },
      error: (err: any) => {
        console.error('Failed to load institutions', err);
        this.institutions = [];
        this.filteredInstitutions = [];
      }
    });
  }

  // called from template (typed)
  public onSearch(): void {
    const term = (this.searchText || '').trim().toLowerCase();
    if (term.length >= 3) {
      this.filteredInstitutions = this.institutions.filter(inst => {
        // FIX: Use correct property 'instituteName'
        const name = (inst.instituteName || '').toString().toLowerCase();
        return name.includes(term);
      });
    } else {
      this.filteredInstitutions = [];
    }
  }

  public selectInstitution(inst: InstitutionDataType): void {
    this.selectedInstitution = inst;
    this.institutionSelected.emit(inst);
  }

  public clearInstitution(): void {
    this.selectedInstitution = null;
    this.searchText = '';
    this.loginData = { userId: '', password: '' };
    this.filteredInstitutionListReset();
    this.institutionSelected.emit(null);
  }

  private filteredInstitutionListReset(): void {
    this.filteredInstitutions = [...this.institutions];
  }

  public login(): void {
    if (this.loginData.userId && this.loginData.password) {
      this.showLoginSuccess = true;
      setTimeout(() => this.router.navigate(['/dashboard']), 1200);
    }
  }
}