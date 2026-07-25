import Foundation

/// Turns per-service `ProviderTrack`s into canonical `UnifiedTrack`s and matches a
/// unified track onto another service. ISRC-first, with a normalized fuzzy fallback.
/// See ARCHITECTURE.md §6.
public struct MatchingEngine {
    /// Duration tolerance for a fuzzy match.
    public var durationToleranceMillis: Int = 2000
    /// Minimum fuzzy score (0...1) to accept a non-ISRC match.
    public var fuzzyAcceptThreshold: Double = 0.82

    public init() {}

    // MARK: Unify

    /// Collapse provider tracks that are the same recording into unified tracks,
    /// grouping by ISRC where present and falling back to a normalized key.
    public func unify(_ tracks: [ProviderTrack]) -> [(track: UnifiedTrack, mappings: [TrackMapping])] {
        var groups: [String: [ProviderTrack]] = [:]
        for t in tracks {
            let key = t.isrc.map { "isrc:\($0)" } ?? "fuzzy:\(Self.normalizedKey(title: t.title, artist: t.artists.first ?? ""))"
            groups[key, default: []].append(t)
        }
        return groups.values.map { members in
            let rep = members[0]
            let unified = UnifiedTrack(
                isrc: rep.isrc,
                title: rep.title,
                artists: rep.artists,
                album: rep.album,
                durationMillis: rep.durationMillis,
                artworkURL: rep.artworkURL
            )
            let mappings = members.map { m in
                TrackMapping(
                    unifiedTrackID: unified.id,
                    service: m.service,
                    providerTrackID: m.providerTrackID,
                    confidence: m.isrc != nil ? 1.0 : 0.85
                )
            }
            return (unified, mappings)
        }
    }

    // MARK: Match onto a service

    public struct MatchResult: Sendable {
        public let candidate: ProviderTrack
        public let confidence: Double
    }

    /// Pick the best candidate on a target service for a unified track.
    /// An exact ISRC hit wins outright (confidence 1.0); otherwise score fuzzily.
    public func bestMatch(for track: UnifiedTrack, among candidates: [ProviderTrack]) -> MatchResult? {
        if let isrc = track.isrc,
           let exact = candidates.first(where: { $0.isrc == isrc }) {
            return MatchResult(candidate: exact, confidence: 1.0)
        }
        var best: MatchResult?
        for c in candidates {
            let score = fuzzyScore(track, c)
            if score >= fuzzyAcceptThreshold, score > (best?.confidence ?? 0) {
                best = MatchResult(candidate: c, confidence: score)
            }
        }
        return best
    }

    // MARK: Scoring

    func fuzzyScore(_ a: UnifiedTrack, _ b: ProviderTrack) -> Double {
        let titleScore = Self.similarity(Self.normalize(a.title), Self.normalize(b.title))
        let artistScore = Self.similarity(
            Self.normalize(a.primaryArtist),
            Self.normalize(b.artists.first ?? "")
        )
        let durationOK = abs(a.durationMillis - b.durationMillis) <= durationToleranceMillis
        let durationScore = durationOK ? 1.0 : 0.0
        // Title and artist dominate; duration is a tie-breaker/guard.
        return titleScore * 0.55 + artistScore * 0.35 + durationScore * 0.10
    }

    static func normalizedKey(title: String, artist: String) -> String {
        "\(normalize(title))|\(normalize(artist))"
    }

    /// Lowercase, strip punctuation, and drop common noise ("(feat. …)", "- remastered").
    static func normalize(_ s: String) -> String {
        var out = s.lowercased()
        for noise in [" (feat", " feat.", " ft.", " - remaster", " (remaster", " - single version", " (live"] {
            if let r = out.range(of: noise) { out = String(out[..<r.lowerBound]) }
        }
        let allowed = CharacterSet.alphanumerics.union(.whitespaces)
        out = String(out.unicodeScalars.filter { allowed.contains($0) })
        return out.trimmingCharacters(in: .whitespaces)
    }

    /// Token Jaccard similarity — cheap, dependency-free, good enough as a fallback.
    static func similarity(_ a: String, _ b: String) -> Double {
        if a == b { return 1.0 }
        let sa = Set(a.split(separator: " ")), sb = Set(b.split(separator: " "))
        if sa.isEmpty || sb.isEmpty { return 0 }
        let inter = sa.intersection(sb).count
        let union = sa.union(sb).count
        return Double(inter) / Double(union)
    }
}
