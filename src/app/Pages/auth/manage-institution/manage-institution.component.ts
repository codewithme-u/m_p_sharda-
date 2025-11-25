// src/app/Pages/auth/manage-institution/manage-institution.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { InstitutionService } from '../../../core/services/InstitutionService/institution.service';
import { InstitutionDataType } from '../../../../../INTERFACE/institution';

@Component({
  selector: 'app-manage-institution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-institution.component.html'
})
export class ManageInstitutionComponent implements OnInit {

  institutions: InstitutionDataType[] = [];

  // ✅ FIX: Initialized correctly
  institutionFormData: InstitutionDataType = {
    id: 0,
    instituteName: '',
    instituteLocation: '',
    instituteImage: ''
  };

  selectedInstitution: InstitutionDataType | null = null;
  selectedLogoBase64: string | null = null;
  selectedLogoFile: File | null = null;

  constructor(private institutionService: InstitutionService) {}

  ngOnInit(): void {
    this.loadInstitutions();
  }

  loadInstitutions(): void {
    this.institutionService.getInstitutionList().subscribe({
      next: (data: InstitutionDataType[]) => {
        this.institutions = data || [];
      },
      error: err => console.error('loadInstitutions error', err)
    });
  }

  onLogoSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedLogoFile = file;

    const reader = new FileReader();
    reader.onload = () => this.selectedLogoBase64 = reader.result as string;
    reader.readAsDataURL(file);
  }

  editInstitution(inst: InstitutionDataType): void {
    this.selectedInstitution = inst;
    this.institutionFormData = { ...inst };
    
    if (inst.instituteImage) {
        this.selectedLogoBase64 = `http://localhost:8080/${inst.instituteImage}`;
    } else {
        this.selectedLogoBase64 = null;
    }
    this.selectedLogoFile = null;
  }

  submitInstitution(form: NgForm): void {
    if (!form.valid) return;

    const formData = new FormData();
    formData.append("institute_name", this.institutionFormData.instituteName || "");
    formData.append("institute_location", this.institutionFormData.instituteLocation || "");

    if (this.selectedLogoFile) {
      formData.append("institute_image", this.selectedLogoFile);
    }

    if (this.selectedInstitution) {
      this.institutionService.updateInstitution(this.selectedInstitution.id, formData).subscribe({
        next: () => {
          this.resetForm();
          this.loadInstitutions();
        },
        error: err => console.error("Update failed", err)
      });

    } else {
      this.institutionService.createInstitution(formData).subscribe({
        next: () => {
          this.resetForm();
          this.loadInstitutions();
        },
        error: err => console.error("Create failed", err)
      });
    }
  }

  removeInstitution(id: number): void {
    if(confirm("Are you sure you want to delete?")) {
      this.institutionService.deleteInstitution(id).subscribe({
        next: () => this.loadInstitutions(),
        error: err => console.error('Delete error', err)
      });
    }
  }

  resetForm(): void {
    this.selectedInstitution = null;
    // ✅ FIX: Clean reset
    this.institutionFormData = {
      id: 0,
      instituteName: '',
      instituteLocation: '',
      instituteImage: ''
    };
    this.selectedLogoBase64 = null;
    this.selectedLogoFile = null;
  }
}