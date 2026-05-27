/**
 * Digital Vesak Thoran (Pandol) Animation & Interaction Engine
 * Handles coordinate generation, procedural vector drawing, LED rendering, and interactive UI bindings.
 */

// Canvas and Rendering context
const canvas = document.getElementById('thoran-canvas');
const ctx = canvas.getContext('2d');
const modalCanvas = document.getElementById('modal-canvas');
const mCtx = modalCanvas.getContext('2d');

// Logical dimensions (independent of physical pixels)
const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 1000;

// Images Cache for panels (0 = Centerpiece, 1-8 = Jataka Chapters)
const panelImages = {};

// Default image URLs for panels
const defaultImageUrls = {
    0: 'assets/buddha_center.png',
    1: 'assets/temple_summit.png',
    2: 'assets/temple_summit.png',
    3: 'assets/temple_summit.png',
    4: 'assets/temple_summit.png',
    5: 'assets/pilgrims_climb.png',
    6: 'assets/temple_summit.png',
    7: 'assets/hewisi_drummer.png',
    8: 'assets/temple_summit.png'
};

// Helper to update uploader item UI state in the sidebar
function updateUploaderUIState(panelId, hasImage) {
    const input = document.querySelector(`.input-panel-img[data-panel="${panelId}"]`);
    if (input) {
        const item = input.closest('.uploader-item');
        if (item) {
            if (hasImage) {
                item.classList.add('has-image');
            } else {
                item.classList.remove('has-image');
            }
        }
    }
}

// Preload a single image and update sidebar state
function loadPanelImage(panelId, url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            panelImages[panelId] = img;
            updateUploaderUIState(panelId, true);
            resolve(img);
        };
        img.onerror = () => {
            console.error(`Failed to load image for panel ${panelId}: ${url}`);
            delete panelImages[panelId];
            updateUploaderUIState(panelId, false);
            resolve(null);
        };
        img.src = url;
    });
}

// Preload all default images
function preloadDefaultImages() {
    const promises = [];
    for (const [panelId, url] of Object.entries(defaultImageUrls)) {
        promises.push(loadPanelImage(parseInt(panelId), url));
    }
    return Promise.all(promises);
}

// Draw crop-cover image inside a circular panel
function drawCoverImageCircle(targetCtx, img, cx, cy, r) {
    targetCtx.save();
    
    // Create circular clipping path
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    targetCtx.clip();
    
    // Calculate scale to cover the circular area (bounding box of size = 2 * r)
    const size = r * 2;
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    
    const scale = Math.max(size / imgWidth, size / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    
    const dx = cx - drawWidth / 2;
    const dy = cy - drawHeight / 2;
    
    targetCtx.drawImage(img, dx, dy, drawWidth, drawHeight);
    
    targetCtx.restore();
}

// Application State
const state = {
    powerOn: true,
    activePattern: 'synchronized',
    speed: 1.0,
    glow: 80,
    theme: 'classic',
    borderPattern: 'turbine',
    volume: 50,
    soundPlaying: false,
    selectedScene: null,
    zoomActive: false,
    currentLang: 'en',
    time: 0,
    // Viridu Storyteller addition
    viriduPlaying: false,
    autoStoryMode: false,
    activeStoryScene: 1
};

// Traditional Sinhala Viridu verses (Kavi)
const viriduLyrics = {
    1: "සුමන සමන් දෙව් රාජිඳු එදා...<br>බුදු හිමි හමුවී ආරාධනා...<br>සමනල කන්දට වඩිනා ලෙසට...<br>දෙපා තබන්නට වැඳ ඉල්ලුවා...",
    2: "බුදුරජුන් එදා ගුවනින් වැඩියා...<br>රන්වන් වළාකුළු මැදින් හැරුණා...<br>සිරි ලංකා දීපය ආලෝක කර...<br>සමනල ගිරි හිස මතට වැඩියා...",
    3: "සමනල කඳු මුදුනත සිපගන්නා...<br>උතුම් බුදු සිරි පා සලකුණ තැබුවා...<br>දසතම බුදු රැස් මාලා විහිදී...<br>ලෝකය සාධු නදින් පිරුණා...",
    4: "සමන් දෙවිඳු රන් සළුවක් ගෙනලා...<br>බුදු සිරි පා කමලත වැඳ වැටිලා...<br>රන් කරඬුවකින් සිරි පා වහලා...<br>දේව සෙනඟ සමඟින් වැන්දාලා...",
    5: "සීතල කඳුවැටි මැදින් එති බැතිමතුන්...<br>නොබියව හිමිදිරි සීතල ඉවසන්...<br>කරුණාවයි සාධු නදින් සැමවිට...<br>කන්ද නැගී එති පහන් දල්වන්...",
    6: "කඳු මුදුනේ ඇති විහාර මන්දිරේ...<br>බෞද්ධ කොඩිය ලෙළදෙන සුළඟේ...<br>සිරි පා හිස ළඟ දොහොත් මුදුන් දී...<br>නමස්කාර කර මුනි සිරි පාදේ...",
    7: "හේවිසි බෙර හඬ ගිගුම් දෙවන්නා...<br>සාධුකාර මැද පූජා පවත්වන්නා...<br>දිව්‍ය තූර්ය නාදෙන් පින් පුරවමින්...<br>සිරි පා පියුමට වැඳ නමදින්නා...",
    8: "ඉර සේවය උදා වන අසිරිය දැකලා...<br>බැතිමතුන්ගෙ සිත් පහන් වීලා...<br>සාධුකාර දී මුනි සිරි පා වඳිමින්...<br>කන්ද බසින්නට සැරසෙති සැමදෙනා..."
};

// Story Metadata (Bilingual)
const jatakaStories = {
    1: {
        en: {
            title: "Sumana Saman's Invitation",
            chapter: "Chapter 1: The Divine Request",
            desc: "God Sumana Saman, the guardian deity of Samanala Kanda (Adam's Peak), visits Lord Buddha during His visit to Kelaniya. Bowing with deep devotion, the deity invites Lord Buddha to climb the holy peak of Samanala Mountain and place His sacred footprint on the summit, establishing a place of worship for all generations."
        },
        si: {
            title: "සුමන සමන් දෙවිඳුගේ ආරාධනාව",
            chapter: "පළමු පරිච්ඡේදය: දිව්‍යමය ඇරයුම",
            desc: "කැලණියට වැඩම කළ බුදුරජාණන් වහන්සේ හමුවන සමනල කඳු අධිපති සුමන සමන් දිව්‍ය රාජයා, උන්වහන්සේට ඉතා බැති සිතින් නමස්කාර කරයි. සමනල කඳු මුදුනට වැඩම කර එහි බුදු සිරි පා සටහන තබා, ලෝක සත්වයාට වැඳ පුදා ගැනීම සඳහා පූජනීය ස්ථානයක් බවට පත් කරන ලෙස දෙවිඳුන් ආරාධනා කරයි."
        }
    },
    2: {
        en: {
            title: "Buddha's Miraculous Arrival",
            chapter: "Chapter 2: The Flight of the Awakened One",
            desc: "Acceding to the request, Lord Buddha travels through the sky from Kelaniya to Samanala Kanda, accompanied by a retinue of enlightened monks. Descending onto the mountaintop amidst glowing golden clouds and divine music, He illuminates the entire wilderness with the light of the Dharma."
        },
        si: {
            title: "හිමිදිරි වනයේ බුදුරජුන් වැඩමවීම",
            chapter: "දෙවන පරිච්ඡේදය: ගුවනින් වැඩමවීම",
            desc: "සුමන සමන් දෙවිඳුගේ ඇරයුම පිළිගත් බුදුරජාණන් වහන්සේ, මහා රහතන් වහන්සේලා සමඟ කැලණි පුරවරයේ සිට ගුවනින් සමනල කන්ද බලා වැඩම කරති. රන්වන් පැහැති දිව්‍යමය වලාකුළු සහ දිව්‍ය තූර්ය නාද මධ්‍යයේ කඳු මුදුනට වඩින බුදුරජාණන් වහන්සේගේ ශ්‍රී දේහයෙන් මුළු පරිසරයම ඒකාලෝක වෙයි."
        }
    },
    3: {
        en: {
            title: "Placing the Sacred Footprint",
            chapter: "Chapter 3: The Seal of Peace",
            desc: "Lord Buddha steps onto the hard sapphire peak, placing His sacred left footprint (Siri Pa) on the summit of Samanala Mountain. As His feet touch the earth, a dazzling aura of six-colored rays flares outwards, and a great tremor shakes the ground, marking the consecration of the mountain."
        },
        si: {
            title: "ශ්‍රී පාද ලාංඡනය පිහිටුවීම",
            chapter: "තෙවන පරිච්ඡේදය: ශ්‍රී පා සලකුණ",
            desc: "බුදුරජාණන් වහන්සේ සමනල කඳු මුදුනත නිල් මැණික් පර්වතය මත තම වම් ශ්‍රී පාද ලාංඡනය පිහිටුවති. උන්වහන්සේගේ ශ්‍රී පාදය පර්වතය මත ස්පර්ශ වනවාත් සමඟම, ෂඩ්වර්ණ බුද්ධ රශ්මිය මුළු විශ්වය පුරාම විහිදී යන අතර, මහ පොළොව කම්පා වෙමින් සාධුකාර නද පැතිර යයි."
        }
    },
    4: {
        en: {
            title: "Worship of the Footprint",
            chapter: "Chapter 4: The Gem-Studded Reliquary",
            desc: "Overjoyed by the gift, God Sumana Saman covers the sacred footprint with a majestic, gem-studded golden casket to shield it from the elements. The gods assemble in the sky, showering heavenly flowers and chanting stanzas in worship of the sacred seal."
        },
        si: {
            title: "ශ්‍රී පාදය වැඳ පුදා ගැනීම",
            chapter: "සිව්වන පරිච්ඡේදය: දේව පූජාව",
            desc: "බුදු සිරි පා සලකුණ දැක අතිශයින්ම සතුටට පත්වන සුමන සමන් දේවරාජයා, එය ස්වභාවික උවදුරුවලින් ආරක්ෂා කරනු පිණිස මැණික් එබ්බවූ රන් කරඬුවකින් සිරි පා සලකුණ වසා තබයි. දෙවි දේවතාවුන් අහසේ රැස්ව මල් වැසි වස්සවමින් නමස්කාර ගාථා ගයති."
        }
    },
    5: {
        en: {
            title: "Pilgrims' Night Climb",
            chapter: "Chapter 5: The Journey of Faith",
            desc: "Through centuries, pilgrims of all ages embark on the challenging night climb up the cold mountain. Carrying oil lamps, incense, and white lotus flowers, they climb the steep rocky stairs in unity, shouting 'Karunawai' (compassion) to encourage one another under the starlit sky."
        },
        si: {
            title: "බැතිමතුන්ගේ කරුණාව",
            chapter: "පස්වන පරිච්ඡේදය: සිරිපා කරුණාව",
            desc: "සියවස් ගණනාවක් මුළුල්ලේ, විවිධ වයස්වල බැතිමත්හු සීතල රාත්‍රියේ දුෂ්කර සමනල ගිර නැගීම ආරම්භ කරති. අත්වල පොල්තෙල් පහන්, සුවඳ දුම් සහ සුදු නෙළුම් මල් රැගෙන, එකිනෙකාට 'කරුණාවයි' පවසමින් ධෛර්යය දෙමින් තරු පිරි අහස යට ගල් පඩි පෙළ නැග යති."
        }
    },
    6: {
        en: {
            title: "The Sacred Peak Shrine",
            chapter: "Chapter 6: The Summit of Devotion",
            desc: "At the peak stands the historic Sri Pada Shrine, where the sacred Buddhist Flag waves proudly in the cold mountain wind. Pilgrims ring the traditional bronze bell to signal the number of times they have climbed, bowing down before the footprint in silent devotion."
        },
        si: {
            title: "සිරිපා මළුව",
            chapter: "හයවන පරිච්ඡේදය: කඳු මුදුනේ සිද්ධස්ථානය",
            desc: "සමනල කඳු මුදුනේ ඓතිහාසික ශ්‍රී පාද මළුව පිහිටා ඇත. එහි සීතල සුළඟේ බෞද්ධ ධජය ලෙළදෙයි. බැතිමතුන් තමන් සිරිපා කරුණා කළ වාර ගණන අනුව සාම්ප්‍රදායික ලෝකඩ ඝණ්ඨාව නාද කරන අතර, ශ්‍රී පාද ලාංඡනය අසල දොහොත් මුදුන් දී වැඳ වැටෙති."
        }
    },
    7: {
        en: {
            title: "Hewisi Drumming Ceremony",
            chapter: "Chapter 7: Rhythms of Worship",
            desc: "The ritualistic drumming and wind instruments (Hewisi Pooja) fill the air. Traditional drummers and horn players dress in pristine white attire, playing powerful sacred rhythms that echo across the mountains, intensifying the deep sense of devotion at the summit."
        },
        si: {
            title: "හේවිසි පූජාව",
            chapter: "හත්වන පරිච්ඡේදය: තූර්ය වාදනය",
            desc: "සම්ප්‍රදායික හේවිසි සහ හොරණෑ හඬ මළුව පුරා පැතිර යයි. පිරිසිදු සුදු වතින් සැරසුණු හේවිසිකරුවන් සාධුකාර මධ්‍යයේ දිව්‍යමය නාද රටා වාදනය කරති. මේ හේවිසි ශබ්දය අවට කඳුවැටිවල දෝංකාර දෙමින් බැතිමතුන්ගේ සිත් ශ්‍රද්ධාවෙන් පුරවයි."
        }
    },
    8: {
        en: {
            title: "The Glorious Sunrise (Ira Sewaya)",
            chapter: "Chapter 8: The Golden Dawn",
            desc: "As dawn breaks, pilgrims gather to witness 'Ira Sewaya'—the spectacular sunrise over the peak. The sun appears to bounce three times on the horizon, creating a triangular shadow of the mountain cast perfectly against the western sky. It is a moment of deep spiritual peace."
        },
        si: {
            title: "සිරිපා ඉර සේවය",
            chapter: "අටවන පරිච්ඡේදය: රන්වන් අරුණෝදය",
            desc: "අලුයම උදාවීමත් සමඟම බැතිමත්හු ශ්‍රී පාද මළුවට රැස් වී 'ඉර සේවය' නැරඹීමට බලා සිටිති. නැගෙනහිර ක්ෂිතිජයෙන් උදාවන හිරු තෙවරක් සිරිපා මළුව දෙසට නමස්කාර කරන්නාක් මෙන් දිස්වන අතර, බටහිර අහසේ කන්දේ ත්‍රිකෝණාකාර සලකුණ පතිත වන අසිරිමත් දසුනකි."
        }
    },
    0: {
        en: {
            title: "Lord Buddha - Sacred Footprint",
            chapter: "Muni Siri Pa Centerpiece",
            desc: "The centerpiece represents Lord Buddha in meditative tranquility (Dhyana Mudra), sitting on a golden lotus under the Bodhi tree. The green concentric rays represent the peaceful forest energy and the divine light of His Supreme Teachings. In Sri Lanka, the worship of the sacred footprint (Siri Pa) is one of the most revered national traditions."
        },
        si: {
            title: "භාග්‍යවත් බුදුරජාණන් වහන්සේ",
            chapter: "මුණි සිරි පා වන්දනා මධ්‍යම පුවරුව",
            desc: "මධ්‍යම පුවරුවෙන් නිරූපණය වන්නේ බෝධි වෘක්ෂය සෙවණේ රන්වන් පද්මාසනයක් මත ධ්‍යාන මුද්‍රාවෙන් වැඩසිටින බුදුරජාණන් වහන්සේය. උන්වහන්සේ වටා විහිදෙන කොළ පැහැති තරංගාකාර බුද්ධ රශ්මිය මඟින් වනාන්තරයේ ශාන්ත බව සහ ධර්මයේ සිසිලස නිරූපණය කෙරේ. ලක්වැසි ජනතාවට ශ්‍රී පාදස්ථානය උතුම්ම පූජනීය ඓතිහාසික උරුමයකි."
        }
    }
};

// Global LED Coordinate list
let leds = [];

// Panels positions in logical coordinates (Perfect Octagon)
const PANELS = [
    { id: 1, cx: 600, cy: 140, r: 75 },
    { id: 2, cx: 855, cy: 246, r: 75 },
    { id: 3, cx: 960, cy: 500, r: 75 },
    { id: 4, cx: 855, cy: 754, r: 75 },
    { id: 5, cx: 600, cy: 860, r: 75 },
    { id: 6, cx: 345, cy: 754, r: 75 },
    { id: 7, cx: 240, cy: 500, r: 75 },
    { id: 8, cx: 345, cy: 246, r: 75 }
];

// Center Buddha coordinates
const CENTER_PANEL = { cx: 600, cy: 500, r: 100 };

// Color Themes definitions (HSL values)
const THEMES = {
    classic: ['red', 'green', 'blue', 'yellow', 'pink', 'white'],
    golden: ['yellow', 'orange', 'white', 'yellow', 'orange', 'white'],
    neon: ['pink', 'blue', 'cyan', 'pink', 'blue', 'white'],
    cool: ['blue', 'green', 'cyan', 'blue', 'green', 'white']
};

/**
 * Generates HSL colors based on selected theme and LED base color
 */
function getThemeColor(baseColor, themeName) {
    if (themeName === 'classic') return baseColor;
    
    const themeColors = THEMES[themeName];
    // Map standard colors to theme palette positions
    const map = {
        'red': themeColors[0],
        'pink': themeColors[1],
        'blue': themeColors[2],
        'green': themeColors[3],
        'yellow': themeColors[4],
        'white': themeColors[5],
        'orange': themeColors[1] // fallback
    };
    return map[baseColor] || baseColor;
}

function generateLeds() {
    leds = [];

    // Helper to add an LED
    const addLed = (x, y, color, group, index) => {
        leds.push({ x, y, baseColor: color, group, index, brightness: 0, size: 4 });
    };

    // Generate 28 concentric rings around Lord Buddha
    // Center at (600, 500)
    // First 5 rings (indices 0 to 4): green, radii 110, 125, 140, 155, 170
    // Remaining 23 rings (indices 5 to 27): white (multicolor), radii 185 to 515 with 15px step
    for (let rIdx = 0; rIdx < 28; rIdx++) {
        const radius = 110 + rIdx * 15;
        const color = (rIdx < 5) ? 'green' : 'white';
        const group = (rIdx < 5) ? `center-green-ring-${rIdx}` : `center-aura-ring-${rIdx}`;
        // Count of LEDs per ring increases with radius to keep density uniform
        const count = 30 + rIdx * 6;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = 600 + radius * Math.cos(angle);
            const y = 500 + radius * Math.sin(angle);
            addLed(x, y, color, group, i);
        }
    }

    // Generate Border LEDs for each Jataka Panel
    PANELS.forEach(panel => {
        if (state.borderPattern === 'turbine') {
            // Inner ring: 12 pink/magenta LEDs
            const innerCount = 12;
            for (let i = 0; i < innerCount; i++) {
                const angle = (i / innerCount) * Math.PI * 2;
                const x = panel.cx + 30 * Math.cos(angle);
                const y = panel.cy + 30 * Math.sin(angle);
                addLed(x, y, 'pink', `panel-border-inner-${panel.id}`, i);
            }
            
            // 8 curved swirling rays of 5 green LEDs each
            const rayCount = 8;
            const ledsPerRay = 5;
            for (let r = 0; r < rayCount; r++) {
                const baseAngle = (r / rayCount) * Math.PI * 2;
                for (let s = 0; s < ledsPerRay; s++) {
                    const radius = 35 + s * 10;
                    // Clockwise swirl angle offset: s * 0.16
                    const angle = baseAngle + s * 0.16;
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    addLed(x, y, 'green', `panel-border-turbine-${panel.id}-${r}`, s);
                }
            }
        } 
        
        else if (state.borderPattern === 'flower') {
            // Inner ring: 12 yellow LEDs
            const innerCount = 12;
            for (let i = 0; i < innerCount; i++) {
                const angle = (i / innerCount) * Math.PI * 2;
                const x = panel.cx + 25 * Math.cos(angle);
                const y = panel.cy + 25 * Math.sin(angle);
                addLed(x, y, 'yellow', `panel-border-inner-${panel.id}`, i);
            }
            
            // 8 flower petals, each formed by a loop of 5 pink/white LEDs
            const petalCount = 8;
            const ledsPerPetal = 5;
            // Angle offsets for loop coordinates
            const petalAngles = [-0.15, -0.07, 0, 0.07, 0.15];
            const petalRadii = [45, 60, 70, 60, 45];
            
            for (let p = 0; p < petalCount; p++) {
                const baseAngle = (p / petalCount) * Math.PI * 2;
                for (let s = 0; s < ledsPerPetal; s++) {
                    const angle = baseAngle + petalAngles[s];
                    const radius = petalRadii[s];
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    // Alternating petal colors (pink / white) for a premium look
                    const color = (p % 2 === 0) ? 'pink' : 'white';
                    addLed(x, y, color, `panel-border-flower-${panel.id}-${p}`, s);
                }
            }
        } 
        
        else if (state.borderPattern === 'sunray') {
            // 12 straight radiating rays of 4 LEDs each
            const rayCount = 12;
            const ledsPerRay = 4;
            const colors = ['blue', 'yellow', 'red', 'white', 'pink']; // Buddhist flag palette mapping
            
            for (let r = 0; r < rayCount; r++) {
                const angle = (r / rayCount) * Math.PI * 2;
                const color = colors[r % colors.length];
                for (let s = 0; s < ledsPerRay; s++) {
                    const radius = 32 + s * 13;
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    addLed(x, y, color, `panel-border-sunray-${panel.id}-${r}`, s);
                }
            }
        } 
        
        else if (state.borderPattern === 'cross') {
            // 8 symmetric arms (horizontal, vertical, diagonal) of 5 LEDs each
            const armCount = 8;
            const ledsPerArm = 5;
            
            for (let a = 0; a < armCount; a++) {
                const angle = (a / armCount) * Math.PI * 2;
                // Horizontal/Vertical arms are red, diagonal arms are blue
                const color = (a % 2 === 0) ? 'red' : 'blue';
                for (let s = 0; s < ledsPerArm; s++) {
                    const radius = 30 + s * 11;
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    addLed(x, y, color, `panel-border-cross-${panel.id}-${a}`, s);
                }
            }
        }

        else if (state.borderPattern === 'diamond') {
            // Diamond Burst: 4 diamond-shaped outlines made of LEDs, nested and rotated
            const diamondColors = ['yellow', 'pink', 'white', 'orange'];
            for (let d = 0; d < 4; d++) {
                const size = 28 + d * 14; // diamond half-size increases per layer
                const rotation = d * (Math.PI / 8); // each diamond is rotated
                const ledsPerSide = 4 + d; // more LEDs on outer diamonds
                const color = diamondColors[d];
                // 4 sides of the diamond
                for (let side = 0; side < 4; side++) {
                    const a1 = rotation + (side / 4) * Math.PI * 2;
                    const a2 = rotation + ((side + 1) / 4) * Math.PI * 2;
                    const x1 = panel.cx + size * Math.cos(a1);
                    const y1 = panel.cy + size * Math.sin(a1);
                    const x2 = panel.cx + size * Math.cos(a2);
                    const y2 = panel.cy + size * Math.sin(a2);
                    for (let s = 0; s < ledsPerSide; s++) {
                        const t2 = s / ledsPerSide;
                        const x = x1 + (x2 - x1) * t2;
                        const y = y1 + (y2 - y1) * t2;
                        addLed(x, y, color, `panel-border-diamond-${panel.id}-${d}-${side}`, s);
                    }
                }
            }
        }

        else if (state.borderPattern === 'spiral') {
            // Spiral Galaxy: Two interleaved spiral arms, one CW and one CCW
            const totalArms = 2;
            const dotsPerArm = 24;
            const spiralColors = ['cyan', 'pink'];
            for (let arm = 0; arm < totalArms; arm++) {
                const armBaseAngle = arm * Math.PI; // 180deg apart
                for (let s = 0; s < dotsPerArm; s++) {
                    const progress = s / dotsPerArm;
                    const radius = 18 + progress * 60; // radius grows
                    const angle = armBaseAngle + progress * Math.PI * 2.5; // 2.5 full turns
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    addLed(x, y, spiralColors[arm], `panel-border-spiral-${panel.id}-${arm}`, s);
                }
            }
            // Bright center core
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                addLed(panel.cx + 10 * Math.cos(a), panel.cy + 10 * Math.sin(a), 'white', `panel-border-spiralcore-${panel.id}`, i);
            }
        }

        else if (state.borderPattern === 'lotus') {
            // Lotus Bloom: 3 layers of petals (inner small, mid, outer large), each layer different color
            const layerDefs = [
                { petals: 6, radius: 28, spread: 0.25, color: 'pink',   dotsPerPetal: 3 },
                { petals: 8, radius: 48, spread: 0.22, color: 'white',  dotsPerPetal: 4 },
                { petals: 10, radius: 68, spread: 0.18, color: 'yellow', dotsPerPetal: 5 }
            ];
            layerDefs.forEach((layer, layerIdx) => {
                for (let p = 0; p < layer.petals; p++) {
                    const petalBaseAngle = (p / layer.petals) * Math.PI * 2;
                    for (let s = 0; s < layer.dotsPerPetal; s++) {
                        const spreadAngle = petalBaseAngle + (s - (layer.dotsPerPetal - 1) / 2) * layer.spread;
                        const x = panel.cx + layer.radius * Math.cos(spreadAngle);
                        const y = panel.cy + layer.radius * Math.sin(spreadAngle);
                        addLed(x, y, layer.color, `panel-border-lotus-${panel.id}-${layerIdx}-${p}`, s);
                    }
                }
            });
        }

        else if (state.borderPattern === 'wave') {
            // Ripple Wave Ring: 4 concentric elliptical rings that ripple outward
            const ringCount = 4;
            for (let r = 0; r < ringCount; r++) {
                const radius = 28 + r * 16;
                const ledsOnRing = 16 + r * 4;
                const colors = ['blue', 'cyan', 'white', 'blue'];
                const color = colors[r];
                for (let i = 0; i < ledsOnRing; i++) {
                    const angle = (i / ledsOnRing) * Math.PI * 2;
                    const x = panel.cx + radius * Math.cos(angle);
                    const y = panel.cy + radius * Math.sin(angle);
                    addLed(x, y, color, `panel-border-wave-${panel.id}-${r}`, i);
                }
            }
        }

        else if (state.borderPattern === 'sunleaf') {
            // Filled red center circle
            for (let dy = -25; dy <= 25; dy += 5) {
                for (let dx = -25; dx <= 25; dx += 5) {
                    if (dx * dx + dy * dy <= 625) {
                        addLed(panel.cx + dx, panel.cy + dy, 'red',
                            `panel-border-sunleaf-center-${panel.id}`, (dy + 25) * 11 + (dx + 25));
                    }
                }
            }
            // 14 cyan teardrop petals: narrow at inner edge, wide at outer tip, slight clockwise curve
            const leafCount = 14;
            for (let p = 0; p < leafCount; p++) {
                const baseAngle = (p / leafCount) * Math.PI * 2;
                let lidx = 0;
                for (let r = 28; r <= 74; r += 5) {
                    const progress = (r - 28) / 46; // 0=inner 1=outer
                    const halfW = 1 + progress * 12; // teardrop widens outward
                    const curve = progress * 0.28;   // slight clockwise sweep
                    for (let w = -halfW; w <= halfW; w += 5) {
                        const la = Math.atan2(w, r) + curve;
                        const lr = Math.sqrt(r * r + w * w);
                        addLed(
                            panel.cx + lr * Math.cos(baseAngle + la),
                            panel.cy + lr * Math.sin(baseAngle + la),
                            'cyan', `panel-border-sunleaf-petal-${panel.id}-${p}`, lidx++);
                    }
                }
            }
        }

        else if (state.borderPattern === 'turboblade') {
            // Filled magenta center circle
            for (let dy = -21; dy <= 21; dy += 5) {
                for (let dx = -21; dx <= 21; dx += 5) {
                    if (dx * dx + dy * dy <= 441) {
                        addLed(panel.cx + dx, panel.cy + dy, 'pink',
                            `panel-border-turboblade-center-${panel.id}`, (dy + 21) * 9 + (dx + 21));
                    }
                }
            }
            // 8 wide, strongly-curved green sickle blades (sweep ~100 deg)
            const bladeCount = 8;
            for (let b = 0; b < bladeCount; b++) {
                const baseAngle = (b / bladeCount) * Math.PI * 2;
                let bidx = 0;
                for (let r = 24; r <= 76; r += 5) {
                    const progress = (r - 24) / 52; // 0=inner 1=outer
                    const sweep = progress * 1.75;   // sweeps ~100 deg total
                    const halfW = 5 + progress * 7;  // blade thickens outward
                    for (let w = -halfW; w <= halfW; w += 5) {
                        const la = Math.atan2(w, r) + sweep;
                        const lr = Math.sqrt(r * r + w * w);
                        addLed(
                            panel.cx + lr * Math.cos(baseAngle + la),
                            panel.cy + lr * Math.sin(baseAngle + la),
                            'green', `panel-border-turboblade-blade-${panel.id}-${b}`, bidx++);
                    }
                }
            }
        }
    });
}

/* --- Dynamic Background Elements --- */
// Twinkling stars generation
function drawBackgroundStars() {
    // Canvas stars field is handled by CSS, but we can draw custom glowing stars on the canvas itself!
    // We draw 40 random glowing canvas stars
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
        // Deterministic pseudo-random seed based on index
        const randX = (Math.sin(i * 4325.23) * 0.5 + 0.5) * LOGICAL_WIDTH;
        const randY = (Math.cos(i * 1234.56) * 0.5 + 0.5) * 400; // top half only
        const twinkle = Math.sin(state.time * 0.05 + i) * 0.4 + 0.6;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.5})`;
        ctx.beginPath();
        ctx.arc(randX, randY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // draw cross ray for brighter stars
        if (i % 8 === 0 && twinkle > 0.8) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${(twinkle - 0.8) * 2})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(randX - 6, randY); ctx.lineTo(randX + 6, randY);
            ctx.moveTo(randX, randY - 6); ctx.lineTo(randX, randY + 6);
            ctx.stroke();
        }
    }
    ctx.restore();
}

/* --- Vector Drawings Module --- */

/**
 * Draws Lord Buddha in meditation at center panel
 */
function drawBuddhaSilhouette(targetCtx, x, y, r) {
    // Use centerpiece image if loaded, falling back to vector art
    const img = panelImages[0];
    if (img && img.complete && img.naturalWidth !== 0) {
        drawCoverImageCircle(targetCtx, img, x, y, r);
        return;
    }
    
    targetCtx.save();
    
    // Background gradient aura
    const auraGrad = targetCtx.createRadialGradient(x, y, r * 0.2, x, y, r);
    auraGrad.addColorStop(0, '#351111');
    auraGrad.addColorStop(0.5, '#1e0722');
    auraGrad.addColorStop(1, '#05030f');
    targetCtx.fillStyle = auraGrad;
    targetCtx.beginPath();
    targetCtx.arc(x, y, r, 0, Math.PI * 2);
    targetCtx.fill();

    // Stylized Bodhi Tree in background
    targetCtx.strokeStyle = 'rgba(0, 255, 135, 0.15)';
    targetCtx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const angle = -Math.PI/2 + (i - 3.5) * 0.25;
        targetCtx.beginPath();
        targetCtx.moveTo(x, y + 20);
        targetCtx.quadraticCurveTo(
            x + Math.cos(angle) * r * 0.6, 
            y + Math.sin(angle) * r * 0.6,
            x + Math.cos(angle) * r * 0.95,
            y + Math.sin(angle) * r * 0.95
        );
        targetCtx.stroke();
    }
    
    // Bodhi Leaves
    targetCtx.fillStyle = 'rgba(0, 255, 135, 0.25)';
    for (let i = 0; i < 15; i++) {
        const leafAngle = -Math.PI/2 + (Math.sin(i) * 1.1);
        const dist = r * 0.6 + (Math.cos(i) * r * 0.3);
        const lx = x + Math.cos(leafAngle) * dist;
        const ly = y + Math.sin(leafAngle) * dist;
        
        targetCtx.beginPath();
        targetCtx.ellipse(lx, ly, 7, 4, leafAngle + Math.PI/4, 0, Math.PI * 2);
        targetCtx.fill();
    }

    // Buddha Halo (Glowing gold circle behind head)
    const headX = x;
    const headY = y - 18;
    const haloGrad = targetCtx.createRadialGradient(headX, headY, 5, headX, headY, 26);
    haloGrad.addColorStop(0, '#fff6bd');
    haloGrad.addColorStop(0.5, '#ffae00');
    haloGrad.addColorStop(1, 'rgba(255, 174, 0, 0)');
    targetCtx.fillStyle = haloGrad;
    targetCtx.beginPath();
    targetCtx.arc(headX, headY, 26, 0, Math.PI*2);
    targetCtx.fill();

    // Double layer Pink Lotus pedestal
    const lotusY = y + 55;
    targetCtx.fillStyle = '#ff69b4';
    targetCtx.beginPath();
    // Bottom petals
    targetCtx.moveTo(x - 55, lotusY);
    targetCtx.bezierCurveTo(x - 30, lotusY + 22, x + 30, lotusY + 22, x + 55, lotusY);
    targetCtx.bezierCurveTo(x + 25, lotusY + 6, x - 25, lotusY + 6, x - 55, lotusY);
    targetCtx.fill();

    targetCtx.fillStyle = '#ff33aa';
    targetCtx.beginPath();
    // Top petals
    targetCtx.moveTo(x - 48, lotusY - 4);
    targetCtx.bezierCurveTo(x - 20, lotusY + 12, x + 20, lotusY + 12, x + 48, lotusY - 4);
    targetCtx.bezierCurveTo(x + 20, lotusY - 2, x - 20, lotusY - 2, x - 48, lotusY - 4);
    targetCtx.fill();

    // Buddha Silhouette (Dark red/brown outline with glowing gold fills)
    targetCtx.fillStyle = '#ffb300';
    targetCtx.strokeStyle = '#3a1300';
    targetCtx.lineWidth = 3.5;
    
    // Robe/Body Path
    targetCtx.beginPath();
    // Head top (Ushnisha)
    targetCtx.moveTo(headX, headY - 18);
    targetCtx.lineTo(headX - 2, headY - 14);
    targetCtx.lineTo(headX - 6, headY - 14);
    // Head shape
    targetCtx.quadraticCurveTo(headX - 11, headY - 10, headX - 11, headY - 4);
    targetCtx.quadraticCurveTo(headX - 11, headY + 4, headX - 6, headY + 8);
    // Left Shoulder
    targetCtx.bezierCurveTo(headX - 18, headY + 14, headX - 35, headY + 20, headX - 38, headY + 34);
    // Left Arm down
    targetCtx.quadraticCurveTo(headX - 42, headY + 54, headX - 30, headY + 58);
    // Crossed Lap
    targetCtx.lineTo(headX + 30, headY + 58);
    // Right Arm up
    targetCtx.quadraticCurveTo(headX + 42, headY + 54, headX + 38, headY + 34);
    // Right Shoulder
    targetCtx.bezierCurveTo(headX + 35, headY + 20, headX + 18, headY + 14, headX + 6, headY + 8);
    // Right Head side
    targetCtx.quadraticCurveTo(headX + 11, headY + 4, headX + 11, headY - 4);
    targetCtx.quadraticCurveTo(headX + 11, headY - 10, headX + 6, headY - 14);
    targetCtx.lineTo(headX + 2, headY - 14);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
    
    // Robe lines (fine detail)
    targetCtx.strokeStyle = 'rgba(74, 25, 0, 0.4)';
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    // Left shoulder robe sash
    targetCtx.moveTo(headX - 6, headY + 10);
    targetCtx.quadraticCurveTo(headX - 12, headY + 30, headX - 26, headY + 58);
    // Right lap curve
    targetCtx.moveTo(headX - 22, headY + 58);
    targetCtx.quadraticCurveTo(headX, headY + 48, headX + 22, headY + 58);
    targetCtx.stroke();

    // Meditative Face Silhouette (Closed eyes, peaceful brow line)
    targetCtx.strokeStyle = 'rgba(74, 25, 0, 0.6)';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    // Left Eye
    targetCtx.moveTo(headX - 6, headY - 2); targetCtx.quadraticCurveTo(headX - 4, headY - 1, headX - 2, headY - 2);
    // Right Eye
    targetCtx.moveTo(headX + 2, headY - 2); targetCtx.quadraticCurveTo(headX + 4, headY - 1, headX + 6, headY - 2);
    // Lips
    targetCtx.moveTo(headX - 3, headY + 3); targetCtx.quadraticCurveTo(headX, headY + 4.5, headX + 3, headY + 3);
    targetCtx.stroke();

    targetCtx.restore();
}

/**
 * Draws Swan at bottom corners
 */
function drawSwanOutline(targetCtx, x, y, isLeft) {
    targetCtx.save();
    
    // Flip canvas horizontally if drawing right swan
    if (!isLeft) {
        targetCtx.translate(x, y);
        targetCtx.scale(-1, 1);
        targetCtx.translate(-x, -y);
    }
    
    // Gradient fill for swan body
    const swanGrad = targetCtx.createLinearGradient(x - 50, y - 100, x + 150, y);
    swanGrad.addColorStop(0, '#ffffff');
    swanGrad.addColorStop(0.5, '#fff0fa');
    swanGrad.addColorStop(1, '#ffcce6');
    targetCtx.fillStyle = swanGrad;
    targetCtx.strokeStyle = '#ff66b2';
    targetCtx.lineWidth = 3;
    
    // Path tracing Swan Hansa shape
    targetCtx.beginPath();
    // Neck base
    targetCtx.moveTo(x - 20, y - 80);
    // Curve up to head
    targetCtx.bezierCurveTo(x - 50, y - 10, x - 10, y + 30, x + 35, y - 20);
    // Head crown
    targetCtx.bezierCurveTo(x + 46, y - 36, x + 38, y - 66, x + 20, y - 80);
    // Inner neck curve down
    targetCtx.quadraticCurveTo(x + 10, y - 110, x + 18, y - 90);
    // Back and tail
    targetCtx.bezierCurveTo(x + 50, y - 130, x + 120, y - 135, x + 150, y - 80);
    // Tail scroll waves
    targetCtx.bezierCurveTo(x + 172, y - 60, x + 168, y - 10, x + 130, y - 15);
    // Body bottom curve
    targetCtx.bezierCurveTo(x + 90, y - 15, x + 20, y - 20, x - 20, y - 80);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    // Draw eye and golden beak
    targetCtx.fillStyle = '#ffa500';
    targetCtx.beginPath();
    targetCtx.moveTo(x + 35, y - 23);
    targetCtx.lineTo(x + 50, y - 20);
    targetCtx.lineTo(x + 38, y - 15);
    targetCtx.closePath();
    targetCtx.fill();

    // Eye
    targetCtx.fillStyle = '#000000';
    targetCtx.beginPath();
    targetCtx.arc(x + 28, y - 28, 2.5, 0, Math.PI*2);
    targetCtx.fill();
    
    // Draw smaller medallion inside swan body
    targetCtx.fillStyle = '#040316';
    targetCtx.strokeStyle = '#00bfff';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.arc(x + 85, y - 57, 20, 0, Math.PI*2);
    targetCtx.fill();
    targetCtx.stroke();
    
    // Medallion silhouette (Small golden lotus or Buddha silhouette)
    targetCtx.fillStyle = '#ffa500';
    targetCtx.beginPath();
    targetCtx.arc(x + 85, y - 58, 6, 0, Math.PI*2); // head
    targetCtx.fill();
    targetCtx.beginPath();
    targetCtx.moveTo(x + 75, y - 48);
    targetCtx.quadraticCurveTo(x + 85, y - 54, x + 95, y - 48); // lap
    targetCtx.lineTo(x + 85, y - 52);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.restore();
}

/**
 * Draws Jataka Scene Illustration inside circles
 */
function drawJatakaScene(targetCtx, sceneNum, cx, cy, r, isZoomed = false) {
    // Use custom/default image if loaded, falling back to vector art
    const img = panelImages[sceneNum];
    if (img && img.complete && img.naturalWidth !== 0) {
        drawCoverImageCircle(targetCtx, img, cx, cy, r);
        return;
    }
    
    targetCtx.save();
    
    // Circle clipping mask
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    targetCtx.clip();

    // Backdrop Gradient based on story mood
    const bgGrad = targetCtx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    
    if (sceneNum === 1) { // Saman's Request: God Sumana Saman invites Buddha. Blue-gold divine background.
        bgGrad.addColorStop(0, '#1e1b4b'); // deep indigo
        bgGrad.addColorStop(0.5, '#4f46e5'); // indigo
        bgGrad.addColorStop(1, '#ffd700'); // gold
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Lord Buddha Silhouette (Left side)
        const bx = cx - r * 0.35;
        const by = cy + r * 0.15;
        const br = r * 0.45;
        
        // Buddha Halo
        const bHalo = targetCtx.createRadialGradient(bx, by - br * 0.3, 2, bx, by - br * 0.3, br * 0.6);
        bHalo.addColorStop(0, '#fff6bd');
        bHalo.addColorStop(0.5, '#ffae00');
        bHalo.addColorStop(1, 'rgba(255,174,0,0)');
        targetCtx.fillStyle = bHalo;
        targetCtx.beginPath();
        targetCtx.arc(bx, by - br * 0.3, br * 0.6, 0, Math.PI*2);
        targetCtx.fill();
        
        // Seated Buddha silhouette
        targetCtx.fillStyle = '#ffb300';
        targetCtx.beginPath();
        // Head
        targetCtx.arc(bx, by - br * 0.3, br * 0.18, 0, Math.PI*2);
        // Body triangle
        targetCtx.moveTo(bx - br * 0.35, by + br * 0.4);
        targetCtx.lineTo(bx, by - br * 0.15);
        targetCtx.lineTo(bx + br * 0.35, by + br * 0.4);
        targetCtx.closePath();
        targetCtx.fill();
        
        // Lotus pedestal
        targetCtx.fillStyle = '#ff69b4';
        targetCtx.fillRect(bx - br * 0.4, by + br * 0.38, br * 0.8, br * 0.15);

        // God Sumana Saman Silhouette (Right side, kneeling and praying)
        const sx = cx + r * 0.35;
        const sy = cy + r * 0.2;
        
        // Saman's Halo
        const sHalo = targetCtx.createRadialGradient(sx, sy - r * 0.2, 2, sx, sy - r * 0.2, r * 0.4);
        sHalo.addColorStop(0, '#e0f2fe');
        sHalo.addColorStop(0.6, '#38bdf8');
        sHalo.addColorStop(1, 'rgba(56,189,248,0)');
        targetCtx.fillStyle = sHalo;
        targetCtx.beginPath();
        targetCtx.arc(sx, sy - r * 0.2, r * 0.4, 0, Math.PI*2);
        targetCtx.fill();
        
        // Saman's Silhouette
        targetCtx.fillStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.moveTo(sx - r * 0.25, sy + r * 0.4);
        targetCtx.quadraticCurveTo(sx - r * 0.15, sy - r * 0.05, sx, sy - r * 0.1); // back
        targetCtx.lineTo(sx + r * 0.1, sy + r * 0.4);
        targetCtx.closePath();
        targetCtx.fill();
        
        // Head & Tall Crown (Jata Mukuta)
        targetCtx.beginPath();
        targetCtx.arc(sx - r * 0.08, sy - r * 0.12, r * 0.09, 0, Math.PI*2); // head
        targetCtx.fill();
        // Tall crown
        targetCtx.beginPath();
        targetCtx.moveTo(sx - r * 0.13, sy - r * 0.18);
        targetCtx.lineTo(sx - r * 0.08, sy - r * 0.38); // crown peak
        targetCtx.lineTo(sx - r * 0.03, sy - r * 0.18);
        targetCtx.closePath();
        targetCtx.fill();
        
        // Praying hands outline
        targetCtx.strokeStyle = '#e0f2fe';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(sx - r * 0.08, sy + r * 0.05);
        targetCtx.quadraticCurveTo(bx, sy, sx - r * 0.08, sy + r * 0.2); // extended arms
        targetCtx.stroke();

    } else if (sceneNum === 2) { // Arrival: Buddha's flight. Golden clouds & rays descending on peak.
        bgGrad.addColorStop(0, '#0f172a'); // night sky
        bgGrad.addColorStop(0.5, '#581c87'); // purple sky
        bgGrad.addColorStop(1, '#ea580c'); // orange horizon
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Mountain Peak silhouette at the bottom
        targetCtx.fillStyle = '#090518';
        targetCtx.beginPath();
        targetCtx.moveTo(cx - r, cy + r);
        targetCtx.lineTo(cx, cy + r * 0.2);
        targetCtx.lineTo(cx + r, cy + r);
        targetCtx.closePath();
        targetCtx.fill();

        // Light rays descending from sky
        targetCtx.strokeStyle = 'rgba(253, 224, 71, 0.25)';
        targetCtx.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
            const startX = cx - r + (i * r * 0.25);
            targetCtx.beginPath();
            targetCtx.moveTo(startX, cy - r);
            targetCtx.lineTo(cx, cy + r * 0.2); // pointing to mountain summit
            targetCtx.stroke();
        }

        // Golden clouds floating
        targetCtx.fillStyle = 'rgba(251, 146, 60, 0.4)';
        targetCtx.beginPath();
        targetCtx.arc(cx - r * 0.4, cy - r * 0.2, r * 0.25, 0, Math.PI*2);
        targetCtx.arc(cx - r * 0.15, cy - r * 0.3, r * 0.3, 0, Math.PI*2);
        targetCtx.arc(cx + r * 0.3, cy - r * 0.25, r * 0.22, 0, Math.PI*2);
        targetCtx.fill();

        // Glowing Buddha figure flying in sky
        const fx = cx;
        const fy = cy - r * 0.35;
        const fHalo = targetCtx.createRadialGradient(fx, fy, 1, fx, fy, r * 0.35);
        fHalo.addColorStop(0, '#ffffff');
        fHalo.addColorStop(0.4, '#fbbf24');
        fHalo.addColorStop(1, 'rgba(251,191,36,0)');
        targetCtx.fillStyle = fHalo;
        targetCtx.beginPath();
        targetCtx.arc(fx, fy, r * 0.35, 0, Math.PI*2);
        targetCtx.fill();
        
        targetCtx.fillStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.arc(fx, fy - r * 0.05, r * 0.05, 0, Math.PI*2); // head
        targetCtx.moveTo(fx - r * 0.08, fy + r * 0.12);
        targetCtx.lineTo(fx, fy - r * 0.02);
        targetCtx.lineTo(fx + r * 0.08, fy + r * 0.12);
        targetCtx.closePath();
        targetCtx.fill();

    } else if (sceneNum === 3) { // Placing Footprint: Sacred footprint on sapphire peak.
        bgGrad.addColorStop(0, '#1e293b'); // dark slate
        bgGrad.addColorStop(0.6, '#0f172a'); // deep space blue
        bgGrad.addColorStop(1, '#1e1b4b'); // deep indigo
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Close-up of Sapphire/Blue Peak surface
        const peakGrad = targetCtx.createRadialGradient(cx, cy + r, r * 0.2, cx, cy + r, r * 1.5);
        peakGrad.addColorStop(0, '#2563eb'); // royal blue sapphire
        peakGrad.addColorStop(0.5, '#1d4ed8');
        peakGrad.addColorStop(1, '#0f172a');
        targetCtx.fillStyle = peakGrad;
        targetCtx.beginPath();
        targetCtx.arc(cx, cy + r * 1.1, r * 1.2, 0, Math.PI*2);
        targetCtx.fill();

        // Footprint outline centered
        const fpx = cx;
        const fpy = cy + r * 0.05;
        const fpW = r * 0.28;
        const fpH = r * 0.65;

        // Radiating rays from footprint
        targetCtx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
        targetCtx.lineWidth = 1.5;
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            targetCtx.beginPath();
            targetCtx.moveTo(fpx, fpy);
            targetCtx.lineTo(fpx + Math.cos(a) * r * 0.9, fpy + Math.sin(a) * r * 0.9);
            targetCtx.stroke();
        }

        // Golden glowing footprint shape
        targetCtx.fillStyle = '#fef08a';
        targetCtx.shadowColor = '#fbbf24';
        targetCtx.shadowBlur = 10;
        
        targetCtx.beginPath();
        // Foot sole (upper round part)
        targetCtx.ellipse(fpx, fpy - fpH * 0.1, fpW * 0.9, fpH * 0.35, 0, 0, Math.PI * 2);
        // Heel
        targetCtx.ellipse(fpx, fpy + fpH * 0.3, fpW * 0.65, fpH * 0.2, 0, 0, Math.PI * 2);
        targetCtx.fill();
        
        // Connecting arch
        targetCtx.beginPath();
        targetCtx.moveTo(fpx - fpW * 0.7, fpy);
        targetCtx.lineTo(fpx + fpW * 0.7, fpy);
        targetCtx.lineTo(fpx + fpW * 0.55, fpy + fpH * 0.25);
        targetCtx.lineTo(fpx - fpW * 0.5, fpy + fpH * 0.25);
        targetCtx.closePath();
        targetCtx.fill();

        // Five toes at the top
        const toeY = fpy - fpH * 0.45;
        for (let i = 0; i < 5; i++) {
            const toeX = fpx - fpW * 0.7 + (i * fpW * 0.35);
            const toeR = fpW * (0.16 - Math.abs(i - 2) * 0.02);
            targetCtx.beginPath();
            targetCtx.arc(toeX, toeY + Math.abs(i - 2) * 3, toeR, 0, Math.PI*2);
            targetCtx.fill();
        }
        targetCtx.shadowBlur = 0;

    } else if (sceneNum === 4) { // Worship Casket: Sumana Saman covers footprint with golden casket.
        bgGrad.addColorStop(0, '#4a044e'); // dark purple
        bgGrad.addColorStop(0.5, '#701a75'); // magenta
        bgGrad.addColorStop(1, '#fbcfe8'); // pink
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Ground/Peak silhouette
        targetCtx.fillStyle = '#1e0b36';
        targetCtx.fillRect(cx - r, cy + r * 0.5, r * 2, r * 0.6);

        // Golden Casket Silhouette
        const cxk = cx;
        const cyk = cy + r * 0.25;
        
        // Glowing aura behind casket
        const cGlow = targetCtx.createRadialGradient(cxk, cyk, 2, cxk, cyk, r * 0.5);
        cGlow.addColorStop(0, '#ffffff');
        cGlow.addColorStop(0.4, '#ffd700');
        cGlow.addColorStop(1, 'rgba(255,215,0,0)');
        targetCtx.fillStyle = cGlow;
        targetCtx.beginPath();
        targetCtx.arc(cxk, cyk, r * 0.5, 0, Math.PI*2);
        targetCtx.fill();

        // Golden Casket (Karanduwa) shape
        targetCtx.fillStyle = '#ffd700';
        targetCtx.strokeStyle = '#9a3412';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        // Dome base
        targetCtx.moveTo(cxk - r * 0.2, cyk + r * 0.25);
        targetCtx.lineTo(cxk + r * 0.2, cyk + r * 0.25);
        targetCtx.lineTo(cxk + r * 0.16, cyk + r * 0.15);
        // Dome body
        targetCtx.quadraticCurveTo(cxk + r * 0.18, cyk - r * 0.1, cxk, cyk - r * 0.15); // right dome
        targetCtx.quadraticCurveTo(cxk - r * 0.18, cyk - r * 0.1, cxk - r * 0.16, cyk + r * 0.15); // left dome
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        
        // Spire (Kotha)
        targetCtx.beginPath();
        targetCtx.moveTo(cxk - r * 0.04, cyk - r * 0.15);
        targetCtx.lineTo(cxk, cyk - r * 0.38); // tip
        targetCtx.lineTo(cxk + r * 0.04, cyk - r * 0.15);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        
        // Crown pinnacle
        targetCtx.fillStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.arc(cxk, cyk - r * 0.38, 3, 0, Math.PI*2);
        targetCtx.fill();

        // God Saman bowing on the Left
        const skx = cx - r * 0.45;
        const sky = cy + r * 0.25;
        targetCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        targetCtx.beginPath();
        targetCtx.moveTo(skx - r * 0.1, sky + r * 0.25);
        targetCtx.quadraticCurveTo(skx, sky - r * 0.08, skx + r * 0.1, sky - r * 0.1); // bending back
        targetCtx.lineTo(skx + r * 0.18, sky + r * 0.25);
        targetCtx.closePath();
        targetCtx.fill();
        
        targetCtx.beginPath();
        targetCtx.arc(skx + r * 0.08, sky - r * 0.12, r * 0.07, 0, Math.PI*2); // head
        targetCtx.fill();
        // Bowing crown
        targetCtx.beginPath();
        targetCtx.moveTo(skx + r * 0.04, sky - r * 0.17);
        targetCtx.lineTo(skx + r * 0.14, sky - r * 0.32);
        targetCtx.lineTo(skx + r * 0.12, sky - r * 0.15);
        targetCtx.closePath();
        targetCtx.fill();

        // Falling petals
        targetCtx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
            const px = cx - r * 0.8 + Math.sin(i * 3) * r * 1.5;
            const py = cy - r * 0.6 + (i * r * 0.15);
            targetCtx.beginPath();
            targetCtx.ellipse(px, py, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
            targetCtx.fill();
        }

    } else if (sceneNum === 5) { // Night Climb: Pilgrims climb the mountain stairs at night.
        bgGrad.addColorStop(0, '#020617'); // dark space
        bgGrad.addColorStop(0.5, '#0f172a'); // slate
        bgGrad.addColorStop(1, '#1e1b4b'); // deep indigo
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Twinkling stars in background
        targetCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 15; i++) {
            const sx = cx - r * 0.8 + (Math.sin(i * 452) * 0.5 + 0.5) * r * 1.6;
            const sy = cy - r * 0.8 + (Math.cos(i * 123) * 0.5 + 0.5) * r * 1.1;
            targetCtx.beginPath();
            targetCtx.arc(sx, sy, 1, 0, Math.PI*2);
            targetCtx.fill();
        }

        // Adam's Peak mountain stairs winding silhouette
        targetCtx.fillStyle = '#05020c';
        targetCtx.beginPath();
        targetCtx.moveTo(cx - r, cy + r);
        targetCtx.lineTo(cx - r * 0.8, cy + r * 0.8);
        targetCtx.lineTo(cx - r * 0.6, cy + r * 0.8); // step
        targetCtx.lineTo(cx - r * 0.4, cy + r * 0.5);
        targetCtx.lineTo(cx - r * 0.2, cy + r * 0.5); // step
        targetCtx.lineTo(cx, cy + r * 0.2);
        targetCtx.lineTo(cx + r * 0.2, cy + r * 0.2); // step
        targetCtx.lineTo(cx + r * 0.5, cy - r * 0.2);
        targetCtx.lineTo(cx + r * 0.7, cy - r * 0.2); // step
        targetCtx.lineTo(cx + r, cy - r * 0.6);
        targetCtx.lineTo(cx + r, cy + r);
        targetCtx.closePath();
        targetCtx.fill();

        // Small pilgrim silhouettes climbing the stairs
        targetCtx.fillStyle = '#cccccc';
        // Pilgrim 1
        targetCtx.beginPath();
        targetCtx.arc(cx - r * 0.45, cy + r * 0.4, 3, 0, Math.PI*2); // head
        targetCtx.fill();
        targetCtx.fillRect(cx - r * 0.48, cy + r * 0.44, 5, 8); // body
        // Pilgrim 2
        targetCtx.beginPath();
        targetCtx.arc(cx - r * 0.1, cy + r * 0.12, 3, 0, Math.PI*2); // head
        targetCtx.fill();
        targetCtx.fillRect(cx - r * 0.13, cy + r * 0.16, 5, 8); // body

        // Glowing lanterns/torches
        targetCtx.fillStyle = '#fef08a';
        targetCtx.shadowColor = '#eab308';
        targetCtx.shadowBlur = 4;
        
        targetCtx.beginPath();
        targetCtx.arc(cx - r * 0.38, cy + r * 0.42, 3.5, 0, Math.PI*2); // torch 1
        targetCtx.arc(cx - r * 0.03, cy + r * 0.14, 3.5, 0, Math.PI*2); // torch 2
        targetCtx.fill();
        
        targetCtx.fillStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.arc(cx - r * 0.38, cy + r * 0.42, 1.5, 0, Math.PI*2);
        targetCtx.arc(cx - r * 0.03, cy + r * 0.14, 1.5, 0, Math.PI*2);
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

    } else if (sceneNum === 6) { // Summit Shrine: Temple shrine silhouette at the summit.
        bgGrad.addColorStop(0, '#1e1b4b'); // deep indigo
        bgGrad.addColorStop(0.5, '#311042'); // purple
        bgGrad.addColorStop(1, '#a21caf'); // magenta
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Mountain summit surface
        targetCtx.fillStyle = '#0a0518';
        targetCtx.fillRect(cx - r, cy + r * 0.5, r * 2, r * 0.6);

        // Summit Shrine building silhouette
        const sx = cx - r * 0.1;
        const sy = cy + r * 0.1;
        
        targetCtx.fillStyle = '#1e293b';
        // Base platform
        targetCtx.fillRect(sx - r * 0.4, sy + r * 0.25, r * 0.9, r * 0.15);
        // Columns
        targetCtx.fillRect(sx - r * 0.3, sy - r * 0.1, r * 0.06, r * 0.35);
        targetCtx.fillRect(sx - r * 0.1, sy - r * 0.1, r * 0.06, r * 0.35);
        targetCtx.fillRect(sx + r * 0.1, sy - r * 0.1, r * 0.06, r * 0.35);
        targetCtx.fillRect(sx + r * 0.3, sy - r * 0.1, r * 0.06, r * 0.35);
        // Roof
        targetCtx.beginPath();
        targetCtx.moveTo(sx - r * 0.45, sy - r * 0.1);
        targetCtx.lineTo(sx + r * 0.45, sy - r * 0.1);
        targetCtx.lineTo(sx + r * 0.35, sy - r * 0.25);
        targetCtx.lineTo(sx - r * 0.35, sy - r * 0.25);
        targetCtx.closePath();
        targetCtx.fill();

        // Waving Buddhist Flag on Right
        const fx = cx + r * 0.48;
        const fy = cy - r * 0.1;
        
        // Flagpole
        targetCtx.strokeStyle = '#cccccc';
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(fx, cy + r * 0.5);
        targetCtx.lineTo(fx, fy - r * 0.3);
        targetCtx.stroke();
        
        // Buddhist Flag stripes
        const flagColors = ['#1d4ed8', '#facc15', '#b91c1c', '#ffffff', '#ea580c'];
        const fWidth = r * 0.26;
        const fHeight = r * 0.16;
        const stripeW = fWidth / 5;
        
        for (let i = 0; i < 5; i++) {
            targetCtx.fillStyle = flagColors[i];
            targetCtx.fillRect(fx + i * stripeW, fy - r * 0.28, stripeW, fHeight);
        }

    } else if (sceneNum === 7) { // Hewisi Drumming: Red/Gold theme
        bgGrad.addColorStop(0, '#7f1d1d');
        bgGrad.addColorStop(0.5, '#b45309');
        bgGrad.addColorStop(1, '#fef08a');
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Drummer Silhouette (Geta Bera)
        targetCtx.fillStyle = '#1e0c03';
        targetCtx.beginPath();
        targetCtx.arc(cx, cy - r * 0.15, r * 0.1, 0, Math.PI*2);
        targetCtx.fill();
        targetCtx.beginPath();
        targetCtx.moveTo(cx - r * 0.25, cy + r * 0.55);
        targetCtx.lineTo(cx, cy + r * 0.05);
        targetCtx.lineTo(cx + r * 0.25, cy + r * 0.55);
        targetCtx.closePath();
        targetCtx.fill();
        // Drum
        targetCtx.fillStyle = '#eab308';
        targetCtx.strokeStyle = '#1e0c03';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.ellipse(cx, cy + r * 0.4, r * 0.32, r * 0.14, 0.05, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

    } else if (sceneNum === 8) { // Rising Sun (Ira Sewaya): Vibrant Sunrise theme
        bgGrad.addColorStop(0, '#f43f5e');
        bgGrad.addColorStop(0.4, '#f97316');
        bgGrad.addColorStop(1, '#facc15');
        targetCtx.fillStyle = bgGrad;
        targetCtx.fill();

        // Rising Sun
        targetCtx.fillStyle = '#ffffff';
        targetCtx.shadowColor = '#facc15';
        targetCtx.shadowBlur = isZoomed ? 30 : 15;
        targetCtx.beginPath();
        targetCtx.arc(cx, cy + r * 0.9, r * 0.6, Math.PI, Math.PI * 2);
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

        // Mountain shadow triangle silhouette
        targetCtx.fillStyle = 'rgba(15, 10, 45, 0.55)';
        targetCtx.beginPath();
        targetCtx.moveTo(cx - r * 0.7, cy + r);
        targetCtx.lineTo(cx, cy + r * 0.05);
        targetCtx.lineTo(cx + r * 0.7, cy + r);
        targetCtx.closePath();
        targetCtx.fill();
    }
    targetCtx.restore();
}

/* --- Main Thoran Graphics Renderer --- */
function drawThoranFrame(targetCtx) {
    targetCtx.save();
    
    // Draw outer golden octagonal borders
    targetCtx.strokeStyle = '#c69532';
    targetCtx.lineWidth = 6;
    
    // Draw concentric octagonal lines connecting all panels
    // Ring 1: Connecting panel centers
    targetCtx.beginPath();
    for (let i = 0; i < PANELS.length; i++) {
        const p = PANELS[i];
        if (i === 0) targetCtx.moveTo(p.cx, p.cy);
        else targetCtx.lineTo(p.cx, p.cy);
    }
    targetCtx.closePath();
    targetCtx.stroke();
    
    // Ring 2: Slightly larger octagonal ring around the outside of the panels
    targetCtx.strokeStyle = 'rgba(198, 149, 50, 0.4)';
    targetCtx.lineWidth = 3;
    targetCtx.beginPath();
    for (let i = 0; i < PANELS.length; i++) {
        const p = PANELS[i];
        const dx = p.cx - 600;
        const dy = p.cy - 500;
        const dist = Math.hypot(dx, dy);
        // Extend outwards by 85px (panel radius + margin)
        const rx = 600 + dx * ((dist + 85) / dist);
        const ry = 500 + dy * ((dist + 85) / dist);
        if (i === 0) targetCtx.moveTo(rx, ry);
        else targetCtx.lineTo(rx, ry);
    }
    targetCtx.closePath();
    targetCtx.stroke();

    // Spokes / Radiating structural beams from centerpiece to the 8 panels
    targetCtx.strokeStyle = '#85641b';
    targetCtx.lineWidth = 4;
    for (let i = 0; i < PANELS.length; i++) {
        const p = PANELS[i];
        const dx = p.cx - 600;
        const dy = p.cy - 500;
        const dist = Math.hypot(dx, dy);
        // Start from centerpiece edge (r = 100) and go to panel edge (r = 75)
        const startX = 600 + dx * (100 / dist);
        const startY = 500 + dy * (100 / dist);
        const endX = p.cx - dx * (75 / dist);
        const endY = p.cy - dy * (75 / dist);
        
        targetCtx.beginPath();
        targetCtx.moveTo(startX, startY);
        targetCtx.lineTo(endX, endY);
        targetCtx.stroke();
    }
    
    targetCtx.restore();
}

function drawThoranStructure() {
    // Clear canvas
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Draw background elements
    drawBackgroundStars();
    
    // Draw connecting structure frame
    drawThoranFrame(ctx);
    
    // Draw all 8 Jataka story panels
    PANELS.forEach(p => {
        drawJatakaScene(ctx, p.id, p.cx, p.cy, p.r);
        
        // Draw golden border circle around each panel
        ctx.save();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffae00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
    
    // Draw Lord Buddha centerpiece
    drawBuddhaSilhouette(ctx, CENTER_PANEL.cx, CENTER_PANEL.cy, CENTER_PANEL.r);
    
    // Draw golden border circle around centerpiece
    ctx.save();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffae00';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(CENTER_PANEL.cx, CENTER_PANEL.cy, CENTER_PANEL.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // Draw Swans (Hansa) at the bottom corners
    drawSwanOutline(ctx, 160, 920, true);
    drawSwanOutline(ctx, 1040, 920, false);
}

/* --- LED Drawing Module --- */
function drawLED(led) {
    const { x, y, baseColor, brightness, size, group, index } = led;
    if (brightness <= 0.03) return;

    let hue = 0, sat = 100, light = 50;
    
    if (baseColor === 'white') {
        // This is a white dot, which must be a multicolor LED!
        if (state.theme === 'classic') {
            // Multicolor HSL color chasing
            if (group.startsWith('center-')) {
                // Center centerpiece rings: HSL color chasing by angle
                const angle = Math.atan2(y - 500, x - 600);
                hue = Math.floor(((angle + Math.PI) / (Math.PI * 2) * 360) + state.time * 2.5) % 360;
            } else {
                hue = (index * 12 + state.time * 2) % 360;
            }
        } else {
            // Other themes: cycle through theme's colors
            const themeColors = THEMES[state.theme];
            let activeColor = 'white';
            
            if (group.startsWith('center-')) {
                const angle = Math.atan2(y - 500, x - 600);
                const cycleIdx = Math.floor(((angle + Math.PI) / (Math.PI * 2) * 10) + state.time * 0.15) % 5;
                activeColor = themeColors[cycleIdx];
            } else {
                const cycleIdx = Math.floor(index * 0.4 + state.time * 0.15) % 5;
                activeColor = themeColors[cycleIdx];
            }

            if (activeColor === 'red') { hue = 355; }
            else if (activeColor === 'green') { hue = 140; }
            else if (activeColor === 'blue') { hue = 198; }
            else if (activeColor === 'yellow') { hue = 52; }
            else if (activeColor === 'pink') { hue = 325; }
            else if (activeColor === 'orange') { hue = 32; }
            else if (activeColor === 'cyan') { hue = 180; }
            else { hue = 0; sat = 0; light = 92; } // white fallback
        }
    } else {
        // Non-white base color (e.g. green centerpiece or yellow waves)
        // Green is always green regardless of theme (green dot only green!)
        const themeColor = (baseColor === 'green') ? 'green' : getThemeColor(baseColor, state.theme);
        if (themeColor === 'red') { hue = 355; }
        else if (themeColor === 'green') { hue = 140; }
        else if (themeColor === 'blue') { hue = 198; }
        else if (themeColor === 'yellow') { hue = 52; }
        else if (themeColor === 'pink') { hue = 325; }
        else if (themeColor === 'white') { hue = 0; sat = 0; light = 92; }
        else if (themeColor === 'orange') { hue = 32; }
        else if (themeColor === 'cyan') { hue = 180; }
    }

    const glowIntensity = state.glow / 80;
    const glowRad = size * (1.6 + brightness * 3.4) * glowIntensity;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRad);
    
    const alphaGlow = 0.5 * brightness;
    grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light + 10}%, ${brightness})`);
    grad.addColorStop(0.25, `hsla(${hue}, ${sat}%, ${light}%, ${alphaGlow})`);
    grad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRad, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = brightness > 0.82 ? '#ffffff' : `hsla(${hue}, ${sat}%, ${light + 15}%, 1)`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
    ctx.fill();
}

/* --- Lighting Patterns & Sequencers --- */
function updateLeds() {
    if (!state.powerOn) {
        leds.forEach(led => led.brightness = 0);
        return;
    }

    const t = state.time * state.speed;

    // Get sound levels if sound-reactive is active
    let soundAmp = 1.0;
    let frequencyArray = [];
    if (state.activePattern === 'sound-reactive' && window.ThoranAudio.isPlaying && window.ThoranAudio.analyser) {
        const bufferLength = window.ThoranAudio.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        window.ThoranAudio.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        soundAmp = (sum / bufferLength) / 120;
        if (soundAmp < 0.2) soundAmp = 0.2;
        frequencyArray = dataArray;
    }

    leds.forEach(led => {
        const group = led.group;
        const idx = led.index;

        if (group.startsWith('panel-border-')) {
            const parts = group.split('-');
            const patternType = parts[2]; // inner, turbine, flower, sunray, cross
            const panelId = parseInt(parts[3]);
            
            let baseBrightness = 0.5;
            
            if (patternType === 'inner') {
                baseBrightness = Math.sin(t * 0.08) * 0.2 + 0.8;
            } else if (patternType === 'turbine') {
                const rayId = parseInt(parts[4]);
                const step = idx;
                baseBrightness = Math.sin(t * 0.18 - rayId * 0.6 + step * 0.3) * 0.45 + 0.55;
            } else if (patternType === 'flower') {
                const petalId = parseInt(parts[4]);
                baseBrightness = Math.sin(t * 0.1 - petalId * 0.5) * 0.45 + 0.55;
            } else if (patternType === 'sunray') {
                const rayId = parseInt(parts[4]);
                const step = idx;
                baseBrightness = Math.sin(t * 0.22 - step * 0.8 + rayId * 0.15) * 0.48 + 0.52;
            } else if (patternType === 'cross') {
                const armId = parseInt(parts[4]);
                const isEven = armId % 2 === 0;
                baseBrightness = Math.sin(t * 0.12 + (isEven ? 0 : Math.PI)) * 0.45 + 0.55;

            } else if (patternType === 'diamond') {
                // Each diamond layer pulses sequentially, creating a ripple-outward effect
                const layerId = parseInt(parts[4]);
                baseBrightness = Math.sin(t * 0.14 - layerId * 0.8) * 0.48 + 0.52;

            } else if (patternType === 'spiral') {
                // Dots light up in a chasing wave along the spiral arms
                baseBrightness = Math.sin(t * 0.22 - idx * 0.18) * 0.48 + 0.52;

            } else if (patternType === 'spiralcore') {
                // Spiral core pulses brightly
                baseBrightness = Math.sin(t * 0.25 + idx * 0.5) * 0.35 + 0.65;

            } else if (patternType === 'lotus') {
                // Each layer blooms in sequence; petal within each layer oscillates
                const layerId = parseInt(parts[4]);
                const petalId = parseInt(parts[5]);
                baseBrightness = Math.sin(t * 0.1 - layerId * 0.55 - petalId * 0.1) * 0.45 + 0.55;

            } else if (patternType === 'wave') {
                // Concentric rings ripple outward like water rings
                const ringId = parseInt(parts[4]);
                baseBrightness = Math.sin(t * 0.18 - ringId * 0.9 + idx * 0.08) * 0.48 + 0.52;

            } else if (patternType === 'sunleaf') {
                if (parts[3] === 'center') {
                    // Red center: slow gentle pulse
                    baseBrightness = Math.sin(t * 0.08) * 0.15 + 0.85;
                } else {
                    // Cyan petals: wave ripples outward from center, petal by petal
                    const petalId = parseInt(parts[4]);
                    baseBrightness = Math.sin(t * 0.12 - petalId * 0.449) * 0.45 + 0.55;
                }

            } else if (patternType === 'turboblade') {
                if (parts[3] === 'center') {
                    // Magenta center: steady throb
                    baseBrightness = Math.sin(t * 0.2) * 0.25 + 0.75;
                } else {
                    // Green blades: chasing spin wave (each blade phase-shifted)
                    const bladeId = parseInt(parts[4]);
                    baseBrightness = Math.sin(t * 0.18 - bladeId * 0.785) * 0.45 + 0.55;
                }
            }
            
            // Apply main pattern influence
            if (state.activePattern === 'sound-reactive') {
                baseBrightness *= soundAmp;
            } else if (state.activePattern === 'twinkle') {
                if (Math.random() > 0.98) {
                    baseBrightness = 1.0;
                } else {
                    baseBrightness = led.brightness * 0.85 + baseBrightness * 0.15;
                }
            } else if (state.activePattern === 'pulsing') {
                baseBrightness *= (Math.sin(t * 0.15) * 0.3 + 0.7);
            }
            
            led.brightness = baseBrightness;
        } else {
            // Existing logic for center and other LEDs
            if (state.activePattern === 'synchronized') {
                if (group.startsWith('center-')) {
                    const ringIdx = parseInt(group.split('-')[3]);
                    led.brightness = Math.sin(t * 0.08 - ringIdx * 0.35) * 0.45 + 0.55;
                } else {
                    led.brightness = Math.sin(t * 0.05 + idx * 0.1) * 0.4 + 0.6;
                }
            } 
            
            else if (state.activePattern === 'radiating') {
                const dist = Math.hypot(led.x - 600, led.y - 500);
                led.brightness = Math.sin((dist * 0.016) - t * 0.07) * 0.48 + 0.52;
            } 
            
            else if (state.activePattern === 'chase') {
                if (group.startsWith('center-')) {
                    const ringIdx = parseInt(group.split('-')[3]);
                    const phase = Math.floor(t * 0.2) % 6;
                    led.brightness = (ringIdx % 6 === phase) ? 1.0 : 0.12;
                } else {
                    led.brightness = Math.sin(t * 0.1 + idx * 0.5) * 0.45 + 0.55;
                }
            } 
            
            else if (state.activePattern === 'pulsing') {
                if (group.startsWith('center-')) {
                    led.brightness = Math.sin(t * 0.15) * 0.45 + 0.55;
                } else {
                    led.brightness = Math.sin(t * 0.04 + Math.PI) * 0.3 + 0.7;
                }
            } 
            
            else if (state.activePattern === 'twinkle') {
                let chance = 0.99;
                if (Math.random() > chance) {
                    led.brightness = 1.0;
                } else {
                    led.brightness = led.brightness * 0.85;
                    if (led.brightness < 0.08) led.brightness = 0.08;
                }
            } 
            
            else if (state.activePattern === 'sound-reactive') {
                if (frequencyArray.length > 0) {
                    if (group.startsWith('center-')) {
                        const ringIdx = parseInt(group.split('-')[3]);
                        const bassLevel = frequencyArray[(idx + ringIdx) % 16] / 255;
                        led.brightness = bassLevel * 0.9 + 0.1;
                    } else {
                        const highLevel = frequencyArray[(idx + 40) % 64] / 255;
                        led.brightness = highLevel * 0.9 + 0.1;
                    }
                } else {
                    const waveVal = Math.sin(t * 0.05 + Math.cos(led.x * 0.01) * 2) * 0.4 + 0.6;
                    led.brightness = waveVal;
                }
            }
        }

        // Apply Viridu play highlighting dimming
        if (state.viriduPlaying) {
            const isSceneHighlighted = (groupName) => {
                if (groupName.startsWith(`panel-${state.activeStoryScene}`)) return true;
                if (groupName.includes(`-${state.activeStoryScene}-`) || groupName.endsWith(`-${state.activeStoryScene}`)) return true;
                if (groupName.startsWith('center') || groupName.startsWith('outer-arch') || groupName.startsWith('base') || groupName.endsWith('swan') || groupName.endsWith('fish') || groupName.startsWith('space-gap-')) return true;
                return false;
            };
            if (!isSceneHighlighted(group)) {
                led.brightness *= 0.12;
            }
        }
    });
}

// Animation loop tick
function tick() {
    state.time++;
    updateLeds();
    drawThoranStructure();
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    leds.forEach(led => {
        drawLED(led);
    });
    ctx.restore();
    
    requestAnimationFrame(tick);
}

/* --- Story Dialog & Nav Modal --- */

function showSceneDetails(sceneId) {
    state.selectedScene = sceneId;
    state.zoomActive = true;
    
    const story = jatakaStories[sceneId][state.currentLang];
    
    // Update text content
    document.querySelectorAll('.story-heading').forEach(el => el.textContent = story.title);
    document.querySelectorAll('.story-chapter').forEach(el => el.textContent = story.chapter);
    document.querySelectorAll('.story-desc').forEach(el => el.textContent = story.desc);
    
    // Update navigation numbers
    document.getElementById('story-page-num').textContent = sceneId === 0 ? "Buddha Center" : `${sceneId} / 8`;
    
    // Draw the zoomed vector artwork on modal canvas
    renderModalArtwork(sceneId);
    
    // Open backdrop
    document.getElementById('story-modal').classList.add('open');
}

function closeSceneDetails() {
    state.zoomActive = false;
    state.selectedScene = null;
    document.getElementById('story-modal').classList.remove('open');
}

function renderModalArtwork(sceneId) {
    // Clear modal canvas
    mCtx.clearRect(0, 0, 400, 400);
    
    if (sceneId === 0) {
        // Draw Buddha Centerpiece
        drawBuddhaSilhouette(mCtx, 200, 180, 130);
    } else {
        // Outer decorative gold border ring
        mCtx.save();
        mCtx.fillStyle = '#060515';
        mCtx.strokeStyle = '#c69532';
        mCtx.lineWidth = 6;
        mCtx.beginPath();
        mCtx.arc(200, 200, 160, 0, Math.PI*2);
        mCtx.fill();
        mCtx.stroke();
        mCtx.restore();
        
        // Draw the vector scene
        drawJatakaScene(mCtx, sceneId, 200, 200, 160, true);
    }
}

function playViriduScene(sceneId) {
    state.activeStoryScene = sceneId;
    
    // Highlight active chapter button in the list
    document.querySelectorAll('.scene-item').forEach(item => {
        const itemSceneId = parseInt(item.dataset.scene);
        if (itemSceneId === sceneId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update overlay lyrics display
    const lyricsTextEl = document.getElementById('viridu-lyrics-text');
    const chapterTitleEl = document.getElementById('viridu-chapter-title');
    const lyricsBoxEl = document.getElementById('viridu-display-box');
    
    if (lyricsTextEl && chapterTitleEl) {
        lyricsTextEl.innerHTML = viriduLyrics[sceneId];
        
        const chaptersSinhala = {
            1: "පළමු පරිච්ඡේදය - සුමන සමන් දෙවිඳුගේ ආරාධනාව",
            2: "දෙවන පරිච්ඡේදය - බුදුරජුන්ගේ වැඩමවීම",
            3: "තෙවන පරිච්ඡේදය - ශ්‍රී පාද ලාංඡනය පිහිටුවීම",
            4: "සිව්වන පරිච්ඡේදය - ශ්‍රී පාදය වැඳ පුදා ගැනීම",
            5: "පස්වන පරිච්ඡේදය - බැතිමතුන්ගේ සිරිපා කරුණාව",
            6: "හයවන පරිච්ඡේදය - සිරිපා මළුවේ සිද්ධස්ථානය",
            7: "හත්වන පරිච්ඡේදය - හේවිසි පූජාව",
            8: "අටවන පරිච්ඡේදය - සිරිපා ඉර සේවය"
        };
        chapterTitleEl.textContent = chaptersSinhala[sceneId];
    }
    
    if (lyricsBoxEl) {
        lyricsBoxEl.classList.remove('hidden');
    }

    // Speak Sinhala Chanting
    if (state.viriduPlaying) {
        window.ThoranAudio.speakSinhalaVerse(viriduLyrics[sceneId], () => {
            // Once speech ends, advance if autoplay is enabled
            if (state.viriduPlaying && state.autoStoryMode) {
                setTimeout(() => {
                    if (state.viriduPlaying && state.autoStoryMode) {
                        let nextScene = state.activeStoryScene + 1;
                        if (nextScene > 8) nextScene = 1;
                        playViriduScene(nextScene);
                    }
                }, 3500); // 3.5s pause between verses
            }
        });
    }
}

/* --- Input Control Bindings --- */
function setupUIListeners() {
    // Power button
    const btnPower = document.getElementById('btn-power');
    btnPower.addEventListener('click', () => {
        state.powerOn = !state.powerOn;
        if (state.powerOn) {
            btnPower.classList.add('active');
            btnPower.innerHTML = '<span class="power-indicator"></span>Power ON';
        } else {
            btnPower.classList.remove('active');
            btnPower.innerHTML = '<span class="power-indicator"></span>Power OFF';
        }
    });

    // Pattern Selection Cards
    document.querySelectorAll('.pattern-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            state.activePattern = btn.dataset.pattern;
        });
    });

    // Speed Slider
    const sliderSpeed = document.getElementById('slider-speed');
    sliderSpeed.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        document.getElementById('val-speed').textContent = `${state.speed.toFixed(1)}x`;
    });

    // Glow Slider
    const sliderGlow = document.getElementById('slider-glow');
    sliderGlow.addEventListener('input', (e) => {
        state.glow = parseInt(e.target.value);
        document.getElementById('val-glow').textContent = `${state.glow}%`;
    });

    // Color Theme Selector
    document.getElementById('theme-selector').addEventListener('change', (e) => {
        state.theme = e.target.value;
    });

    // Border Pattern Selector
    document.getElementById('border-pattern-selector').addEventListener('change', (e) => {
        state.borderPattern = e.target.value;
        generateLeds(); // Re-construct coordinates list
    });

    // Audio Play Toggle
    const btnAudio = document.getElementById('btn-audio');
    btnAudio.addEventListener('click', () => {
        state.soundPlaying = !state.soundPlaying;
        if (state.soundPlaying) {
            btnAudio.classList.add('playing');
            btnAudio.innerHTML = '<i class="fa-solid fa-volume-high"></i> Mute Ambiance';
            window.ThoranAudio.start();
        } else {
            btnAudio.classList.remove('playing');
            btnAudio.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Play Ambiance';
            window.ThoranAudio.stop();
        }
    });

    // Audio Volume Slider
    const sliderVolume = document.getElementById('slider-volume');
    sliderVolume.addEventListener('input', (e) => {
        state.volume = parseInt(e.target.value);
        document.getElementById('val-volume').textContent = `${state.volume}%`;
        window.ThoranAudio.setVolume(state.volume);
    });

    // Story List sidebar items
    document.querySelectorAll('.scene-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const sceneId = parseInt(e.currentTarget.dataset.scene);
            showSceneDetails(sceneId);
        });
    });

    // Canvas click detection for circular panels
    canvas.addEventListener('click', (e) => {
        // Convert screen coordinates to canvas logical coordinate space
        const rect = canvas.getBoundingClientRect();
        const scaleX = LOGICAL_WIDTH / rect.width;
        const scaleY = LOGICAL_HEIGHT / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        // Check if center Buddha is clicked
        const distCenter = Math.hypot(mx - CENTER_PANEL.cx, my - CENTER_PANEL.cy);
        if (distCenter < CENTER_PANEL.r) {
            showSceneDetails(0);
            return;
        }

        // Check if any of the 6 outer panels are clicked
        for (let i = 0; i < PANELS.length; i++) {
            const p = PANELS[i];
            const dist = Math.hypot(mx - p.cx, my - p.cy);
            if (dist < p.r) {
                showSceneDetails(p.id);
                break;
            }
        }
    });

    // Modal Close
    document.getElementById('btn-modal-close').addEventListener('click', closeSceneDetails);
    document.getElementById('story-modal').addEventListener('click', (e) => {
        if (e.target.id === 'story-modal') closeSceneDetails();
    });

    // Language tabs inside modal
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const lang = e.target.dataset.lang;
            state.currentLang = lang;
            
            // Switch active text layouts
            if (lang === 'en') {
                document.getElementById('story-content-si').classList.remove('active');
                document.getElementById('story-content-en').classList.add('active');
            } else {
                document.getElementById('story-content-en').classList.remove('active');
                document.getElementById('story-content-si').classList.add('active');
            }
            
            // Refresh content text
            showSceneDetails(state.selectedScene);
        });
    });

    // Modal Navigation (Prev / Next)
    document.getElementById('btn-story-prev').addEventListener('click', () => {
        let prevId = state.selectedScene - 1;
        if (prevId < 0) prevId = 8;
        showSceneDetails(prevId);
    });
    
    document.getElementById('btn-story-next').addEventListener('click', () => {
        let nextId = state.selectedScene + 1;
        if (nextId > 8) nextId = 0;
        showSceneDetails(nextId);
    });

    // Sidebar Toggle (Mobile)
    const sidebar = document.getElementById('main-controls');
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    toggleBtn.addEventListener('click', (e) => {
        sidebar.classList.toggle('open');
        const isOpen = sidebar.classList.contains('open');
        toggleBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 900 && !sidebar.contains(e.target) && e.target !== toggleBtn) {
            sidebar.classList.remove('open');
            toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    });

    // Viridu Play / Pause Toggle
    const btnViriduPlay = document.getElementById('btn-viridu-play');
    const lyricsBoxEl = document.getElementById('viridu-display-box');
    
    btnViriduPlay.addEventListener('click', () => {
        state.viriduPlaying = !state.viriduPlaying;
        
        if (state.viriduPlaying) {
            btnViriduPlay.classList.add('playing');
            btnViriduPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Viridu';
            
            // Stop background ambiance if playing to prevent overlaps
            if (state.soundPlaying) {
                state.soundPlaying = false;
                document.getElementById('btn-audio').classList.remove('playing');
                document.getElementById('btn-audio').innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Play Ambiance';
                window.ThoranAudio.stop();
            }
            
            // Start Raban beat
            window.ThoranAudio.startViridu();
            
            // Show overlay box and start chanting active scene
            if (lyricsBoxEl) lyricsBoxEl.classList.remove('hidden');
            playViriduScene(state.activeStoryScene);
        } else {
            btnViriduPlay.classList.remove('playing');
            btnViriduPlay.innerHTML = '<i class="fa-solid fa-play"></i> Play Viridu (Sinhala)';
            
            // Stop Raban beat and Speech
            window.ThoranAudio.stopViridu();
            
            // Hide overlay box
            if (lyricsBoxEl) lyricsBoxEl.classList.add('hidden');
        }
    });

    // Auto Play Checkbox
    const chkAutoplay = document.getElementById('chk-autoplay');
    chkAutoplay.addEventListener('change', (e) => {
        state.autoStoryMode = e.target.checked;
        if (state.viriduPlaying && state.autoStoryMode) {
            playViriduScene(state.activeStoryScene);
        }
    });

    // Manual Chapter Navigation
    document.getElementById('btn-viridu-prev').addEventListener('click', () => {
        let prevScene = state.activeStoryScene - 1;
        if (prevScene < 1) prevScene = 8;
        playViriduScene(prevScene);
    });

    document.getElementById('btn-viridu-next').addEventListener('click', () => {
        let nextScene = state.activeStoryScene + 1;
        if (nextScene > 8) nextScene = 1;
        playViriduScene(nextScene);
    });

    // Image Upload Inputs
    document.querySelectorAll('.input-panel-img').forEach(input => {
        input.addEventListener('change', (e) => {
            const panelId = parseInt(e.target.dataset.panel);
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    loadPanelImage(panelId, dataUrl).then(() => {
                        // If modal is currently open displaying this scene, refresh it
                        if (state.selectedScene === panelId) {
                            renderModalArtwork(panelId);
                        }
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    });

    // Image Reset Buttons
    document.querySelectorAll('.btn-reset-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const panelId = parseInt(btnEl.dataset.panel);
            const defaultUrl = defaultImageUrls[panelId];
            
            // Reset the file input value
            const input = document.querySelector(`.input-panel-img[data-panel="${panelId}"]`);
            if (input) {
                input.value = '';
            }
            
            if (defaultUrl) {
                loadPanelImage(panelId, defaultUrl).then(() => {
                    if (state.selectedScene === panelId) {
                        renderModalArtwork(panelId);
                    }
                });
            } else {
                delete panelImages[panelId];
                updateUploaderUIState(panelId, false);
                if (state.selectedScene === panelId) {
                    renderModalArtwork(panelId);
                }
            }
        });
    });
}

/* --- Responsive Canvas Scaling --- */
function resizeCanvas() {
    // Get physical dimensions of parent container
    const wrapper = canvas.parentElement;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    // Retain aspect ratio (1200:1000)
    const targetRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const currentRatio = width / height;

    let displayWidth, displayHeight;
    if (currentRatio > targetRatio) {
        displayHeight = height * 0.95;
        displayWidth = displayHeight * targetRatio;
    } else {
        displayWidth = width * 0.98;
        displayHeight = displayWidth / targetRatio;
    }

    // Set canvas dimensions with high-density DPI scaling
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = displayWidth * devicePixelRatio;
    canvas.height = displayHeight * devicePixelRatio;
    
    // Scale drawings back
    ctx.scale(devicePixelRatio * (displayWidth / LOGICAL_WIDTH), devicePixelRatio * (displayHeight / LOGICAL_HEIGHT));
}

/* --- Initialization --- */
function init() {
    // Generate LEDs
    generateLeds();
    
    // Hide lyrics overlay initially
    const lyricsBoxEl = document.getElementById('viridu-display-box');
    if (lyricsBoxEl) lyricsBoxEl.classList.add('hidden');
    
    // Bind resizing
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Set UI Controls
    setupUIListeners();
    
    // Preload default images
    preloadDefaultImages();
    
    // Loading Screen Progress Simulator (smooth 800ms fadeout)
    let progress = 0;
    const progressFill = document.getElementById('loading-progress');
    const loadInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadInterval);
            setTimeout(() => {
                const screen = document.getElementById('loading-screen');
                screen.style.opacity = '0';
                setTimeout(() => screen.remove(), 600);
                
                // Start animation loop tick after Google Fonts are fully loaded
                document.fonts.ready.then(() => {
                    tick();
                });
            }, 300);
        }
        progressFill.style.width = `${progress}%`;
    }, 50);
}

// Fire initialization when document is fully loaded
window.addEventListener('DOMContentLoaded', init);
