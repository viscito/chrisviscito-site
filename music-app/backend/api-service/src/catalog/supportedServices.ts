import type { PlaybackMode, ServiceId, SupportStatus } from "../domain.js";

export interface ServiceDescriptor {
  service: ServiceId;
  displayName: string;
  playbackMode: PlaybackMode;
  status: SupportStatus;
  requirement: string;
  note: string;
}

/** The R5 registry — top-5 US services and their Crossfade support. Governed by the
 * in-app-first policy (only Mode A/B adopted). Mirrors CrossfadeKit's SupportedServices. */
export const SUPPORTED_SERVICES: ServiceDescriptor[] = [
  { service: "spotify", displayName: "Spotify", playbackMode: "backgroundBroker", status: "comingNext",
    requirement: "Spotify Premium",
    note: "In-app: Crossfade owns the UI; the Spotify app brokers audio in the background." },
  { service: "appleMusic", displayName: "Apple Music", playbackMode: "inApp", status: "live",
    requirement: "Apple Music subscription",
    note: "Plays fully inside Crossfade via MusicKit. First supported service." },
  { service: "amazonMusic", displayName: "Amazon Music", playbackMode: "backgroundBroker", status: "investigating",
    requirement: "Amazon Music Unlimited",
    note: "Confirming an in-app playback path that keeps the user in Crossfade." },
  { service: "youTubeMusic", displayName: "YouTube Music", playbackMode: "deepLinkHandoff", status: "notSupported",
    requirement: "YouTube Music Premium",
    note: "No compliant in-app playback — would push the user out to the YouTube Music app." },
  { service: "pandora", displayName: "Pandora", playbackMode: "deepLinkHandoff", status: "notSupported",
    requirement: "Pandora Premium",
    note: "No third-party playback available to keep listening inside Crossfade." },
];

const BY_ID = new Map(SUPPORTED_SERVICES.map((s) => [s.service, s]));

export function descriptorFor(service: ServiceId): ServiceDescriptor | undefined {
  return BY_ID.get(service);
}
export function playbackModeFor(service: ServiceId): PlaybackMode {
  return BY_ID.get(service)?.playbackMode ?? "inApp";
}
