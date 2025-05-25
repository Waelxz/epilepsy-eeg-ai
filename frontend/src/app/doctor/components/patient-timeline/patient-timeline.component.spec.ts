import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientTimelineComponent } from './patient-timeline.component';

describe('PatientTimelineComponent', () => {
  let component: PatientTimelineComponent;
  let fixture: ComponentFixture<PatientTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientTimelineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
