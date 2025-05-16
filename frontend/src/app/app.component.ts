import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppSettingsService } from './shared/services/app-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'frontend';

  constructor(private appSettingsService: AppSettingsService) {}

  ngOnInit(): void {
    // Make sure theme settings are applied at the component level too
    this.appSettingsService.loadAndApplySettings();
  }
}
