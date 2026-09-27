# Sea Hampton House — Luxury Waterfront Estate

**Listing Website for GitHub Pages**

---

## 🏠 Property Details

- **Price:** $4,850,000
- **Bedrooms:** 5
- **Bathrooms:** 4.5
- **Square Feet:** 4,200
- **Lot Size:** 0.52 acres
- **Water Frontage:** 120 feet
- **MLS:** #[NUMBER]

---

## 📁 Asset Organization

### From Google Drive
**Source:** https://drive.google.com/drive/folders/18Jk7v1IHaTyQQrwoOtHmoul5nlE94atV

**Copy these files to `assets/images/`:**

| File in Drive | Save As | Description |
|---------------|---------|-------------|
| [Hero/Exterior photo] | `hero-exterior.jpg` | Main hero image |
| [Living room] | `living-room.jpg` | Living area |
| [Kitchen] | `kitchen.jpg` | Gourmet kitchen |
| [Master bedroom] | `master-bedroom.jpg` | Primary suite |
| [Bathroom] | `bathroom.jpg` | Spa bathroom |
| [Dock/Water] | `dock.jpg` | Private dock |
| [Pool] | `pool.jpg` | Pool area |
| [Dining room] | `dining.jpg` | Dining area |
| [Map] | `location-map.jpg` | Location/area map |

**Copy to `assets/docs/`:**
- Floor plan PDF → `floorplan.pdf`

---

## 🚀 Deploy to GitHub Pages

### 1. Add Assets from Google Drive

```bash
# Download images from Drive folder
# Save to: ~/sea-hampton-house/assets/images/

# Download floor plan
# Save to: ~/sea-hampton-house/assets/docs/
```

### 2. Update Property Details

Edit `index.html`:
- Replace `[Street Address]` with actual address
- Replace `[Agent Name]` with listing agent
- Replace `[Brokerage Name]` with brokerage
- Update phone, email, website
- Add MLS number
- Update price if needed

### 3. Commit and Push

```bash
cd ~/sea-hampton-house

git add .
git commit -m "Initial commit: Sea Hampton House listing website"
git push -u origin main
```

### 4. Enable GitHub Pages

1. Go to: https://github.com/xmrtdao/sea-hampton-house/settings/pages
2. Source: Deploy from branch
3. Branch: `main` / `/ (root)`
4. Click **Save**

**Live URL:** https://xmrtdao.github.io/sea-hampton-house

---

## 📋 Website Sections

1. **Hero** — Full-screen exterior photo with price and CTA
2. **Features Bar** — 5/4.5/4,200/0.52/120' stats
3. **About** — Property description + living room photo
4. **Features Grid** — 6 premium features with icons
5. **Gallery** — 8-photo grid with hover effects
6. **Floor Plan** — PDF or placeholder with room breakdown
7. **Location** — Neighborhood highlights + map
8. **Contact** — Agent info + showing request form

---

## 🎨 Design Features

- **Color Scheme:**
  - Primary: Navy blue (#1a3a52)
  - Accent: Gold (#c9a962)
  - Clean white backgrounds

- **Typography:**
  - Headings: Playfair Display (serif, luxury feel)
  - Body: Inter (sans-serif, modern readability)

- **Responsive:** Mobile, tablet, desktop optimized

- **Interactive:**
  - Smooth scroll navigation
  - Hover effects on gallery
  - Form submission handler
  - Parallax hero section
  - Scroll animations

---

## 📝 Next Steps

### Immediate
- [ ] Download all images from Google Drive
- [ ] Add floor plan PDF
- [ ] Update agent/contact information
- [ ] Add actual property address
- [ ] Add MLS number
- [ ] Test contact form

### Optional Enhancements
- [ ] Add virtual tour link (Matterport, etc.)
- [ ] Add video walkthrough
- [ ] Integrate with MLS/IDX
- [ ] Add mortgage calculator
- [ ] Connect form to CRM/email service
- [ ] Add neighborhood guide PDF
- [ ] School district information
- [ ] Property disclosure documents

---

## 🛠️ Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom styles, no framework
- **JavaScript** — Vanilla JS, no dependencies
- **GitHub Pages** — Free hosting
- **Google Fonts** — Playfair Display + Inter

---

## 📞 Contact

**Listing Agent:** [Agent Name]  
**Brokerage:** [Brokerage Name]  
**Phone:** (555) 123-4567  
**Email:** agent@brokerage.com

---

## License

Property listing website for Sea Hampton House. All rights reserved.

© 2026 [Brokerage Name]. Equal Housing Opportunity.
