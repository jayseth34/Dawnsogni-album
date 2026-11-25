/** Content stored in content.json (edited through the admin dashboard). */
export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Deluxe';
export type ReleaseStatus = 'teaser' | 'announced' | 'upcoming' | 'released';

export interface Credit { role: string; name: string; }

export interface Track {
  id: string;
  title: string;
  audio: string;            // media path
  duration?: number;        // seconds (filled by admin)
  explicit?: boolean;
  previewStart?: number;    // seconds — where the 30s preview starts
  unlocked?: boolean;       // playable in full before the release date (a single from an upcoming album)
  featured?: boolean;       // show in "Featured tracks" on Home
  lyrics?: string;          // plain or [mm:ss.xx] synced
  credits?: string;         // free text e.g. "Prod. X · Written by Y"
}

export interface Release {
  id: string;
  title: string;
  type: ReleaseType;
  status: ReleaseStatus;
  published: boolean;
  featured?: boolean;
  releaseDate?: string;     // ISO date-time
  description?: string;
  cover?: string;
  teaserArt?: string;
  teaserText?: string;
  credits?: Credit[];
  exclusive?: boolean;
  accessHash?: string;      // sha-256 of the access code for exclusive releases
  tracks: Track[];
}

export interface SiteContent {
  artist: { name: string; tagline?: string };
  shopUrl?: string;
  instagram?: string;
  releases: Release[];
}

/** A release with its computed stage for the current moment. */
export interface ViewRelease extends Release {
  stage: ReleaseStatus;     // effective stage (auto "released" once the date passes)
  date: Date | null;
  year: string;
  displayTitle: string;     // hidden during teaser
  displayCover: string;     // teaser art during teaser
  showTracklist: boolean;
  totalDuration: number;
}

/** Listener data saved on the device. */
export interface Playlist { id: string; name: string; trackIds: string[]; created: number; }
export interface HistoryItem { trackId: string; at: number; }
export interface Profile { name: string; avatar: string; }
export interface Prefs { autoplay: boolean; reduceMotion: boolean; showExplicit: boolean; }
