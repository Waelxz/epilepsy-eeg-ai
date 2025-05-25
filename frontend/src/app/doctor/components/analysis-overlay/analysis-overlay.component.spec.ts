import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisOverlayComponent } from './analysis-overlay.component';

describe('AnalysisOverlayComponent', () => {
  let component: AnalysisOverlayComponent;
  let fixture: ComponentFixture<AnalysisOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisOverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
