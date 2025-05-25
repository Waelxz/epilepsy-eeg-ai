import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisNewComponent } from './analysis-new.component';

describe('AnalysisNewComponent', () => {
  let component: AnalysisNewComponent;
  let fixture: ComponentFixture<AnalysisNewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisNewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisNewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
