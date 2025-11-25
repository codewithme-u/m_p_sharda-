// src/app/Pages/auth/institutions/institutions.component.ts
import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
import { InstitutionDataType } from './../../../../../INTERFACE/institution';

declare var bootstrap: any;

@Component({
  selector: 'app-institutions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './institutions.component.html',
  styleUrls: ['./institutions.component.css'],
})
export class InstitutionsComponent implements OnInit {
  public institutions: InstitutionDataType[] = [];
  public filteredInstitutions: InstitutionDataType[] = [];
  
  @Output() listUpdated = new EventEmitter<number>();

  public searchText = '';
  public showForm = false;
  
  // ✅ FIX: Initialized correctly without 'name'/'image' errors
  public InstitutionData: InstitutionDataType = {
    id: 0,
    instituteName: '',
    instituteLocation: '',
    instituteImage: ''
  };

  public selectedFile: File | null = null;
  public previewUrl: string | ArrayBuffer | null = null;
  public errorMessage = '';
  public isEditMode = false;
  public selectedInstitutionToDelete: InstitutionDataType | null = null;

  constructor(private institutionService: InstitutionService) {}

  ngOnInit(): void {
    this.getInstitutions();
    this.institutionService.refreshNeeded$.subscribe(() => {
      this.getInstitutions();
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  getInstitutions(): void {
    this.institutionService.getInstitutionList().subscribe({
      next: (data) => {
        this.institutions = data || [];
        this.applyFilter();
        this.listUpdated.emit(this.institutions.length);
      },
      error: (err) => console.error(err)
    });
  }

  applyFilter() {
    if (!this.searchText) {
      this.filteredInstitutions = [...this.institutions];
    } else {
      const term = this.searchText.toLowerCase();
      this.filteredInstitutions = this.institutions.filter(i => 
        i.instituteName?.toLowerCase().includes(term) || 
        i.instituteLocation?.toLowerCase().includes(term)
      );
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => this.previewUrl = reader.result;
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onSubmit(): void {
    const name = this.InstitutionData.instituteName?.trim();
    const location = this.InstitutionData.instituteLocation?.trim();

    if (!name || !location) {
      this.errorMessage = 'Name and Location are required.';
      return;
    }

    const formData = new FormData();
    formData.append('institute_name', name);
    formData.append('institute_location', location);
    if (this.selectedFile) formData.append('institute_image', this.selectedFile);

    if (this.isEditMode) {
      this.institutionService.updateInstitution(this.InstitutionData.id, formData).subscribe({
        next: () => this.handleSuccess('Updated successfully!'),
        error: () => this.errorMessage = 'Update failed.'
      });
    } else {
      this.institutionService.createInstitution(formData).subscribe({
        next: () => this.handleSuccess('Created successfully!'),
        error: () => this.errorMessage = 'Creation failed.'
      });
    }
  }

  handleSuccess(msg: string) {
    this.getInstitutions();
    this.resetForm();
    this.showForm = false;
    this.showSuccessModal(msg);
  }

  editInstitution(inst: InstitutionDataType) {
    this.InstitutionData = { ...inst };
    this.previewUrl = inst.instituteImage ? `http://localhost:8080/${inst.instituteImage}` : null;
    this.selectedFile = null;
    this.isEditMode = true;
    this.showForm = true;
    window.scrollTo(0,0);
  }

  openDeleteModal(inst: InstitutionDataType) {
    this.selectedInstitutionToDelete = inst;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
  }

  confirmDelete() {
    if (this.selectedInstitutionToDelete) {
      this.institutionService.deleteInstitution(this.selectedInstitutionToDelete.id).subscribe({
        next: () => {
          this.getInstitutions();
          const el = document.getElementById('deleteModal');
          if(el) bootstrap.Modal.getInstance(el).hide();
        }
      });
    }
  }

  resetForm() {
    // ✅ FIX: Clean reset
    this.InstitutionData = { id: 0, instituteName: '', instituteLocation: '', instituteImage: '' };
    this.selectedFile = null;
    this.previewUrl = null;
    this.isEditMode = false;
    this.errorMessage = '';
  }

  showSuccessModal(msg: string) {
    const el = document.getElementById('successModal');
    const body = document.getElementById('successModalBody');
    if(el && body) {
      body.innerText = msg;
      new bootstrap.Modal(el).show();
    }
  }
}