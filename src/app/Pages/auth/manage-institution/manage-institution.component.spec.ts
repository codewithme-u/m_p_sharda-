import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageInstitutionComponent } from './manage-institution.component';

describe('ManageInstitutionComponent', () => {
  let component: ManageInstitutionComponent;
  let fixture: ComponentFixture<ManageInstitutionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageInstitutionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageInstitutionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
