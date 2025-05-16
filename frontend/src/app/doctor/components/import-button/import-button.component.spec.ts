import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportButtonComponent } from './import-button.component';

describe('ImportButtonComponent', () => {
  let component: ImportButtonComponent;
  let fixture: ComponentFixture<ImportButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
