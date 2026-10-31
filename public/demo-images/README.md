# 📸 CivicEye Demo Images

Place the following image files in this directory (`public/demo-images/`) for realistic live hackathon presentation:

| Filename | Purpose | Recommended Content |
|---|---|---|
| `pothole_before.jpg` | Scenario 1 & 5 | Photo of an asphalt road pothole before repair |
| `pothole_after.jpg` | Scenario 1 (Happy path) | Same spot with newly paved and rolled asphalt patch |
| `fake_fix_other_place.jpg` | Scenario 2 (Cheat caught) | Different street/location or photo of a computer screen |
| `garbage_before.jpg` | Scenario 3 | Overflowing waste bin / roadside garbage dump |
| `garbage_after_partial.jpg` | Scenario 3 (Borderline fix) | Bin emptied but surrounding scatter remains (confidence 50-74) |
| `waterleak_before.jpg` | Scenario 4 | Water main pipe rupture flooding street |
| `streetlight_before.jpg` | General demo | Dark street lamps along roadway |
| `drain_before.jpg` | General demo | Clogged drainage grate with stagnant rainwater |

---

### Fallback Generator
If any image file above is missing, the CivicEye demo engine dynamically renders a labeled canvas placeholder (e.g., `MISSING: pothole_after.jpg`) and warns the presenter in the Demo Checklist so the live presentation never crashes or stalls.
