"""Token-level WCAG contrast; not a complete rendered accessibility audit."""
from pathlib import Path
import json
OUT = Path(__file__).resolve().parent.parent

def luminance(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in channels]
    return sum(a * b for a, b in zip(linear, (.2126, .7152, .0722)))

def ratio(a, b):
    low, high = sorted((luminance(a), luminance(b)))
    return round((high + .05) / (low + .05), 2)

cases = [
    ('light primary text', '#0F172A', '#FFFFFF'),
    ('light muted text', '#475569', '#FFFFFF'),
    ('dark primary text', '#F1F5F9', '#161A22'),
    ('dark muted text', '#94A3B8', '#161A22'),
    ('dark primary action', '#FFFFFF', '#2563EB'),
]
result = {'method': 'WCAG sRGB contrast from reviewed CSS tokens, not a full rendered contrast audit',
          'cases': [{'name': name, 'foreground': a, 'background': b, 'ratio': ratio(a, b)} for name, a, b in cases]}
(OUT / 'contrast-tokens.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
