import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisSummaryComponent } from './analysis-summary.component';

describe('AnalysisSummaryComponent', () => {
  let component: AnalysisSummaryComponent;
  let fixture: ComponentFixture<AnalysisSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
