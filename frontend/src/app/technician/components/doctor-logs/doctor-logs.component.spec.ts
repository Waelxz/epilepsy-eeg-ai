import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DoctorLogsComponent } from './doctor-logs.component';

describe('DoctorLogsComponent', () => {
  let component: DoctorLogsComponent;
  let fixture: ComponentFixture<DoctorLogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorLogsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DoctorLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
