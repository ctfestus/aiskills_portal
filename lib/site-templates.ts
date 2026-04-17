/**
 * Site template registry.
 *
 * To add a new template:
 *  1. Add an entry to TEMPLATES with its id, label, and default config.
 *  2. Create the landing page component (receives SiteConfig as props).
 *  3. Register it in app/page.tsx template switch.
 */

export type SiteConfig = {
  // Colours
  primaryColor:    string;
  accentColor:     string;
  // Typography
  headingFont:     string;
  bodyFont:        string;
  // Hero
  heroTitle:       string;
  heroTitleAccent: string;
  heroSubheadline: string;
  heroPrimaryCta:  string;
  heroImageUrl:    string;
  heroFontSize:       string;  // desktop font size in px (mobile scales proportionally)
  heroOverlayColor:   string;
  heroOverlayOpacity: string;  // 0-100
  statsEnrolled:   string;
  statsRating:     string;
  // Offerings section (Momentum)
  offeringsLabel:          string;
  offeringsHeading:        string;
  offeringsHeadingAccent:  string;
  offeringsSubtext:        string;
  offering1Title: string; offering1Description: string; offering1Badge: string;
  offering2Title: string; offering2Description: string; offering2Badge: string;
  offering3Title: string; offering3Description: string; offering3Badge: string;
  offering4Title: string; offering4Description: string; offering4Badge: string;
  // Steps section (Momentum)
  stepsLabel:          string;
  stepsHeading:        string;
  stepsHeadingAccent:  string;
  step1Title: string; step1Body: string;
  step2Title: string; step2Body: string;
  step3Title: string; step3Body: string;
  // Features section (Momentum)
  featuresLabel:         string;
  featuresHeading:       string;
  featuresHeadingAccent: string;
  featuresSubtext:       string;
  featuresCta:           string;
  highlight1: string; highlight2: string; highlight3: string; highlight4: string;
  highlight5: string; highlight6: string; highlight7: string; highlight8: string;
  // Testimonials
  testimonialsLabel:   string;
  testimonialsHeading: string;
  testimonial1Name: string; testimonial1Role: string; testimonial1Text: string;
  testimonial2Name: string; testimonial2Role: string; testimonial2Text: string;
  testimonial3Name: string; testimonial3Role: string; testimonial3Text: string;
  testimonialVideoUrl: string;
  // CTA banner
  ctaHeading:       string;
  ctaHeadingAccent: string;
  ctaSubtext:       string;
  ctaButton:        string;
  // Footer
  footerTagline: string;
  // Tracks/Programmes section (Elevate)
  tracksLabel:          string;
  tracksHeading:        string;
  tracksHeadingAccent:  string;
  track1Title: string; track1Description: string; track1ImageUrl: string; track1Badge: string;
  track2Title: string; track2Description: string; track2ImageUrl: string; track2Badge: string;
  track3Title: string; track3Description: string; track3ImageUrl: string; track3Badge: string;
  // Impact stats (Elevate)
  impactLabel: string;
  stat1Value: string; stat1Label: string; stat1ImageUrl: string;
  stat2Value: string; stat2Label: string; stat2ImageUrl: string;
  stat3Value: string; stat3Label: string; stat3ImageUrl: string;
  stat4Value: string; stat4Label: string; stat4ImageUrl: string;
  statImgOverlay: string;  // 0-100, darkness of image overlay on stat cards
  // Partners strip (Elevate)
  partnersLabel:   string;
  partner1Name: string; partner1LogoUrl: string;
  partner2Name: string; partner2LogoUrl: string;
  partner3Name: string; partner3LogoUrl: string;
  partner4Name: string; partner4LogoUrl: string;
  partner5Name: string; partner5LogoUrl: string;
  partner6Name: string; partner6LogoUrl: string;
  // Newsletter / CTA (Elevate)
  newsletterHeading: string;
  newsletterSubtext: string;
  newsletterButton:  string;
  // Section colours (Elevate)
  navBgColor:        string;
  navTextColor:      string;
  sectionDarkBg:     string;
  sectionLightBg:    string;
  sectionAltBg:      string;
  textHeadingColor:  string;  // text on light sections
  textBodyColor:     string;  // body text on light sections
  textMutedColor:    string;  // muted text on light sections
  textOnDarkColor:   string;  // heading/body on dark sections (stats, footer)
  textOnAltColor:    string;  // heading/body on alternate sections (testimonials, partners)
  cardBadgeBg:       string;  // programme card badge background
  cardBadgeText:     string;  // programme card badge text colour
  cardOverlayColor:  string;  // programme card image overlay colour
  cardOverlayOpacity: string; // programme card overlay opacity 0-100
  // Section visibility ('1' = hidden, '' = visible)
  hideOfferings:    string;
  hideSteps:        string;
  hideFeatures:     string;
  hideTestimonials: string;
  hideCta:          string;
  hidePartners:     string;
  hideStats:        string;
  // Sticky CTA bar
  stickyCtaText:   string;
  stickyCtaButton: string;
  hideStickyBar:   string;
  // Footer custom links
  footerLinksHeading: string;
  footerLink1Label: string; footerLink1Url: string;
  footerLink2Label: string; footerLink2Url: string;
  footerLink3Label: string; footerLink3Url: string;
  footerLink4Label: string; footerLink4Url: string;
  // Footer background image
  footerBgImageUrl:     string;
  footerOverlayColor:   string;
  footerOverlayOpacity: string;
  // Floating CTA card (overlaps footer)
  floatingCtaHeading:  string;
  floatingCtaSubtext:  string;
  floatingCtaButton:   string;
  floatingCtaImageUrl: string;
  floatingCtaBgColor:  string;
  hideFloatingCta:     string;
};

export type Template = {
  id:       string;
  label:    string;
  defaults: SiteConfig;
};

const ELEVATE_EMPTY = {
  tracksLabel: '', tracksHeading: '', tracksHeadingAccent: '',
  track1Title: '', track1Description: '', track1ImageUrl: '', track1Badge: '',
  track2Title: '', track2Description: '', track2ImageUrl: '', track2Badge: '',
  track3Title: '', track3Description: '', track3ImageUrl: '', track3Badge: '',
  impactLabel: '',
  stat1Value: '', stat1Label: '', stat1ImageUrl: '',
  stat2Value: '', stat2Label: '', stat2ImageUrl: '',
  stat3Value: '', stat3Label: '', stat3ImageUrl: '',
  stat4Value: '', stat4Label: '', stat4ImageUrl: '',
  statImgOverlay: '',
  partnersLabel: '',
  partner1Name: '', partner1LogoUrl: '',
  partner2Name: '', partner2LogoUrl: '',
  partner3Name: '', partner3LogoUrl: '',
  partner4Name: '', partner4LogoUrl: '',
  partner5Name: '', partner5LogoUrl: '',
  partner6Name: '', partner6LogoUrl: '',
  newsletterHeading: '', newsletterSubtext: '', newsletterButton: '',
  navBgColor: '', navTextColor: '',
  sectionDarkBg: '', sectionLightBg: '', sectionAltBg: '',
  textHeadingColor: '', textBodyColor: '', textMutedColor: '',
  textOnDarkColor: '', textOnAltColor: '',
  cardBadgeBg: '', cardBadgeText: '',
  cardOverlayColor: '', cardOverlayOpacity: '',
  hideOfferings: '', hideSteps: '', hideFeatures: '',
  hideTestimonials: '', hideCta: '', hidePartners: '', hideStats: '',
};

const MOMENTUM_EMPTY = {
  offeringsLabel: '', offeringsHeading: '', offeringsHeadingAccent: '', offeringsSubtext: '',
  offering1Title: '', offering1Description: '', offering1Badge: '',
  offering2Title: '', offering2Description: '', offering2Badge: '',
  offering3Title: '', offering3Description: '', offering3Badge: '',
  offering4Title: '', offering4Description: '', offering4Badge: '',
  stepsLabel: '', stepsHeading: '', stepsHeadingAccent: '',
  step1Title: '', step1Body: '', step2Title: '', step2Body: '', step3Title: '', step3Body: '',
  featuresLabel: '', featuresHeading: '', featuresHeadingAccent: '', featuresSubtext: '', featuresCta: '',
  highlight1: '', highlight2: '', highlight3: '', highlight4: '',
  highlight5: '', highlight6: '', highlight7: '', highlight8: '',
  hideOfferings: '', hideSteps: '', hideFeatures: '',
  hideTestimonials: '', hideCta: '', hidePartners: '', hideStats: '',
};

export const TEMPLATES: Template[] = [
  {
    id:    'momentum',
    label: 'Momentum',
    defaults: {
      primaryColor:   '#0e09dd',
      accentColor:    '#ff9933',
      headingFont:    'Inter',
      bodyFont:       'Inter',
      heroTitle:          'Build the skills Africa',
      heroTitleAccent:    'needs right now.',
      heroSubheadline:    'Enrol in AI and data courses, attend live workshops, work through real industry projects, and earn certificates that employers in Africa and beyond recognise.',
      heroPrimaryCta:     'Start learning free',
      heroImageUrl:       '',
      heroFontSize:       '56',
      heroOverlayColor:   '#000000',
      heroOverlayOpacity: '58',
      statsEnrolled:      '10,000+',
      statsRating:        '4.9',
      offeringsLabel:         'What you get',
      offeringsHeading:       'Everything you need to grow',
      offeringsHeadingAccent: 'your career.',
      offeringsSubtext:       'From beginner courses to advanced guided projects -- built for the modern professional.',
      offering1Title: 'Courses',         offering1Description: 'Structured, hands-on courses covering data analysis, machine learning, Python, SQL, and more.',             offering1Badge: 'Courses',
      offering2Title: 'Live Events',     offering2Description: 'Join live training sessions, webinars, and expert-led workshops. Interact in real time and build your network.', offering2Badge: 'Events',
      offering3Title: 'Guided Projects', offering3Description: 'Work through realistic industry scenarios. Apply your skills to real business problems across multiple sectors.',  offering3Badge: 'Projects',
      offering4Title: 'Certificates',   offering4Description: 'Earn verified certificates for every course and project. Share your achievements with a public profile built for career growth.', offering4Badge: 'Certificates',
      stepsLabel:         'Your journey',
      stepsHeading:       'From zero to job-ready',
      stepsHeadingAccent: 'in 3 steps.',
      step1Title: 'Enrol in a course or project', step1Body: 'Browse courses and guided projects built for professionals. Pick what matches your goals and start immediately.',
      step2Title: 'Learn and practise',           step2Body: 'Work through lessons, hands-on exercises, and real datasets. Apply skills directly to problems you face at work.',
      step3Title: 'Earn, grow, and get hired',    step3Body: 'Pass assessments, earn verified certificates, and share your profile with employers. Proof your skills are real.',
      featuresLabel:         'Platform features',
      featuresHeading:       'Built for the serious',
      featuresHeadingAccent: 'learner.',
      featuresSubtext:       'Every feature is designed to help you learn faster, prove your skills, and advance your career.',
      featuresCta:           'Start for free',
      highlight1: 'Courses built for professionals',     highlight2: 'Verified certificates for every course',
      highlight3: 'Live events and community workshops', highlight4: 'Guided projects in real industry scenarios',
      highlight5: 'Leaderboard and peer competition',    highlight6: 'Public learning profile with your URL',
      highlight7: 'Anti-cheat assessments with retakes', highlight8: 'Light and dark mode dashboard',
      testimonialsLabel:   'What learners say',
      testimonialsHeading: 'Real results from real people.',
      testimonial1Name: 'Amina Osei',        testimonial1Role: 'Data Analyst, Accra',              testimonial1Text: 'This platform gave me the practical skills I needed to move from Excel to Python and SQL. Within three months I landed a data analyst role at a fintech company.',
      testimonial2Name: 'Chukwuemeka Nwosu', testimonial2Role: 'BI Lead, Lagos',                   testimonial2Text: 'The guided projects are exactly what I needed. Real business scenarios, not textbook exercises. My team now relies on dashboards I built from what I learned here.',
      testimonial3Name: 'Fatima Al-Hassan',  testimonial3Role: 'HR Analytics Specialist, Nairobi', testimonial3Text: 'The live workshops gave me direct access to industry experts. The certificate I earned opened doors that years of self-study could not. Highly recommended.',
      testimonialVideoUrl: '',
      ctaHeading:       'Join {statsEnrolled} professionals',
      ctaHeadingAccent: 'building the future.',
      ctaSubtext:       'Start learning today. No credit card required. Access your first course for free and see the difference real, practical skills make.',
      ctaButton:        'Start learning free',
      footerTagline:    'The AI and data skills platform built for African professionals. Learn, practise, and prove your skills.',
      stickyCtaText:   'Join 10,000+ professionals building Africa\'s future.',
      stickyCtaButton: 'Start for free',
      hideStickyBar:   '',
      footerLinksHeading: 'Learn',
      footerLink1Label: 'Courses',        footerLink1Url: '/auth',
      footerLink2Label: 'Guided Projects', footerLink2Url: '/auth',
      footerLink3Label: 'Live Events',    footerLink3Url: '/auth',
      footerLink4Label: 'Certificates',   footerLink4Url: '/auth',
      footerBgImageUrl: '', footerOverlayColor: '#000000', footerOverlayOpacity: '70',
      floatingCtaHeading:  'Stay ahead of the curve.',
      floatingCtaSubtext:  'Get updates on new courses, live events, and opportunities delivered to you.',
      floatingCtaButton:   'Subscribe Now',
      floatingCtaImageUrl: '',
      floatingCtaBgColor:  '',
      hideFloatingCta:     '',
      ...ELEVATE_EMPTY,
    },
  },
  {
    id:    'elevate',
    label: 'Elevate',
    defaults: {
      primaryColor: '#1a1a2e',
      accentColor:  '#e94560',
      headingFont:  'Inter',
      bodyFont:     'Inter',
      heroTitle:       'Choose Your Path.',
      heroTitleAccent: 'Transform Your Future.',
      heroSubheadline: 'Join thousands of ambitious professionals building in-demand skills through world-class programmes, mentorship, and real-world projects.',
      heroPrimaryCta:  'Explore programmes',
      heroImageUrl:    '',
      heroFontSize:    '62',
      heroOverlayColor:   '#000000',
      heroOverlayOpacity: '58',
      statsEnrolled:   '50,000+',
      statsRating:     '4.8',
      tracksLabel:          'Our programmes',
      tracksHeading:        'Build skills that',
      tracksHeadingAccent:  'open doors.',
      track1Title: 'AI & Data',          track1Description: 'Master the technologies driving the next decade. Learn Python, machine learning, and data science through hands-on projects.',  track1ImageUrl: '', track1Badge: 'Most popular',
      track2Title: 'Creative & Design',  track2Description: 'Develop in-demand creative skills across UX/UI, graphic design, video production, and digital storytelling.',                   track2ImageUrl: '', track2Badge: 'Growing fast',
      track3Title: 'Entrepreneurship',   track3Description: 'Launch and grow a business with support from mentors, investors, and a global network of successful founders.',                 track3ImageUrl: '', track3Badge: 'High impact',
      impactLabel: 'Our impact',
      stat1Value: '50,000+', stat1Label: 'Graduates worldwide',      stat1ImageUrl: '',
      stat2Value: '12,000+', stat2Label: 'Entrepreneurs supported',  stat2ImageUrl: '',
      stat3Value: '80%',     stat3Label: 'Employment rate',          stat3ImageUrl: '',
      stat4Value: '150+',    stat4Label: 'Countries represented',    stat4ImageUrl: '',
      statImgOverlay: '60',
      partnersLabel: 'Trusted by leading organisations',
      partner1Name: 'Google',     partner1LogoUrl: '',
      partner2Name: 'Microsoft',  partner2LogoUrl: '',
      partner3Name: 'Meta',       partner3LogoUrl: '',
      partner4Name: 'IBM',        partner4LogoUrl: '',
      partner5Name: 'Mastercard', partner5LogoUrl: '',
      partner6Name: 'UNICEF',     partner6LogoUrl: '',
      testimonialsLabel:   'Success stories',
      testimonialsHeading: 'Real people, real impact.',
      testimonialVideoUrl: '',
      testimonial1Name: 'Sarah Kimani', testimonial1Role: 'Data Scientist, Nairobi', testimonial1Text: 'The programme completely changed my trajectory. Within 6 months of graduating I had a full-time data science role at a leading tech company. The mentorship and community were invaluable.',
      testimonial2Name: 'David Mensah', testimonial2Role: 'UX Designer, Accra',     testimonial2Text: 'I came in with zero design experience and left with a portfolio that landed me three job offers. The curriculum is world-class and the instructors genuinely care about your success.',
      testimonial3Name: 'Amara Diallo', testimonial3Role: 'Founder, Dakar',         testimonial3Text: 'The entrepreneurship track gave me the frameworks and network I needed to launch my startup. We raised our first funding round just 4 months after graduating.',
      newsletterHeading: 'Ready to transform',
      newsletterSubtext: 'Join thousands of professionals who chose to invest in themselves. Your next chapter starts here.',
      newsletterButton:  'Start your journey',
      ctaHeading:       'Ready to transform',
      ctaHeadingAccent: 'your career?',
      ctaSubtext:       'Join thousands of professionals who chose to invest in themselves. Your next chapter starts here.',
      ctaButton:        'Start your journey',
      footerTagline:    'Empowering the next generation of professionals through world-class education and mentorship.',
      stickyCtaText:   'Join 50,000+ ambitious professionals.',
      stickyCtaButton: 'Explore programmes',
      hideStickyBar:   '',
      footerLinksHeading: 'Programmes',
      footerLink1Label: 'AI & Data',       footerLink1Url: '/auth',
      footerLink2Label: 'Creative & Design', footerLink2Url: '/auth',
      footerLink3Label: 'Entrepreneurship', footerLink3Url: '/auth',
      footerLink4Label: 'Certificates',    footerLink4Url: '/auth',
      footerBgImageUrl: '', footerOverlayColor: '#0a0a1a', footerOverlayOpacity: '75',
      floatingCtaHeading:  'Subscribe to our updates.',
      floatingCtaSubtext:  'We bring together industry leaders to share insights, spark ideas, and help you level up.',
      floatingCtaButton:   'Subscribe Now',
      floatingCtaImageUrl: '',
      floatingCtaBgColor:  '',
      hideFloatingCta:     '',
      navBgColor:       '#ffffff',
      navTextColor:     '#111111',
      sectionDarkBg:    '#0d0d0d',
      sectionLightBg:   '#ffffff',
      sectionAltBg:     '#f8f9fa',
      textHeadingColor: '#111111',
      textBodyColor:    '#6b7280',
      textMutedColor:   '#9ca3af',
      textOnDarkColor:  '#ffffff',
      textOnAltColor:   '#111111',
      cardBadgeBg:      '#ffffff',
      cardBadgeText:    '#1a1a2e',
      cardOverlayColor:   '#0a0a1a',
      cardOverlayOpacity: '55',
      ...MOMENTUM_EMPTY,
    },
  },
  // Add new templates here -- the dashboard picks them up automatically.
];

export function getTemplate(id: string): Template {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
}

/** Merge saved config over template defaults so missing keys always have a value. */
export function resolveConfig(template: string, saved: Partial<SiteConfig>): SiteConfig {
  return { ...getTemplate(template).defaults, ...saved };
}
