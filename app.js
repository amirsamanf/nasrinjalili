import {
  unlockVault, seal, open, sealJSON, openJSON, toB64, fromB64, randomId,
} from "./vault-crypto.js";

/* ====================================================================== */
/* constants                                                               */
/* ====================================================================== */
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = "https://api.github.com";
// No personal details live in this public file: every name, date and number
// comes from the decrypted case data at runtime.
const IDLE_MS = 20 * 60 * 1000;
const IRCC_MAX = 4 * 1048576; // IRCC's upload limit per file
const WORK_YEARS = 5; // citizenship asks for the last 5 years of addresses and activities
const NEED_DAYS = 1095;
const ELIG_PAGE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility.html";
const APPLY_PAGE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/apply.html";
const CIT_PORTAL = "https://citapply-citdemande.apps.cic.gc.ca/en/landing";
const PHOTO_SPECS = "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/apply/photo.html";
const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

if (window.top !== window.self) {
  document.body.innerHTML = "<p style='padding:24px'>This page can't be shown inside another site.</p>";
  throw new Error("framed");
}

/* ====================================================================== */
/* prefs                                                                   */
/* ====================================================================== */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* ====================================================================== */
/* i18n                                                                    */
/* ====================================================================== */
const T = {
  en: {
    brand: "Case vault",
    vaultSub: "Private case vault",
    unlockSub: "Sign in to open the encrypted file.",
    username: "Username", password: "Password", show: "Show", hide: "Hide",
    unlock: "Unlock", unlocking: "Unlocking…",
    wrong: "That username or password doesn't match. Check for typos and try again.",
    gateFoot: "Everything is encrypted on this device before it's stored. Without the password the data is unreadable, even to GitHub.",
    noVault: "This site isn't set up yet: vault.json is missing.",
    lock: "Lock", theme: "Theme",
    saved: "Encrypted · saved", saving: "Saving…", offline: "Couldn't save · retrying", pending: "Saving soon…", local: "Test mode · this browser only",
    tabOverview: "Overview", tabGaps: "Fill the gaps", tabDocs: "Documents", tabNotes: "Notes & paste", tabSubmit: "Apply",
    progress: "Progress",
    caseTitle: "Canadian citizenship",
    // presence
    presence: "Physical presence", ofDays: "of {need} days", eligibleNow: "Eligible now", eligibleOn: "Eligible from {date}",
    eligibleOnD: "If she stays in Canada until then.", eligibleNowD: "Based on the dates entered, counted for an application on {date}.",
    noPrDate: "Add the date she became a permanent resident to start counting.",
    prDays: "As a permanent resident", preDays: "Before PR (half days, max 365)", awayDays: "Days outside Canada", windowLbl: "5-year window",
    presenceNote: "An estimate. IRCC's calculator inside the online application decides. Leaving and returning days count as days in Canada.",
    eligPage: "IRCC eligibility rules", openPortal: "Online application",
    // steps
    s_eligible: "Eligibility check", s_history: "Trips, addresses, work", s_answers: "Other questions", s_ids: "ID numbers",
    s_docs: "Documents ready", s_online: "Online application", s_submit: "Signed & paid", s_after: "Test & oath",
    // overview
    ovTitle: "Where things stand",
    ovStatus: "{done} of 8 steps are done.",
    ovNextIs: "Next:",
    nextTitle: "Do these next",
    factsTitle: "What we know",
    logTitle: "Recent activity",
    reqTitle: "What she needs",
    reqBody: "1,095 days in Canada in the 5 years before applying · taxes filed for 3 of those years · English or French at CLB 4 · the citizenship test (ages 18–54).",
    fStatus: "Status", fPassport: "Passport", fTaxes: "Taxes filed", fLang: "Language proof", fFee: "Fee", fContact: "Contact",
    prSince: "PR since {date}", taxN: "{n} of the last 5 years", taxNeed: "IRCC needs 3 of 5", notYet: "Not entered yet",
    feeBody: "Adult: processing fee plus right of citizenship fee.",
    nxStatus: "Enter her PR date and time before PR", nxStatusD: "Starts the physical presence count.",
    nxTrips: "List her trips outside Canada", nxTripsD: "Every trip in the last 5 years, with the dates she left and came back.",
    nxAnswers: "Answer {n} more questions", nxAnswersD: "Taxes, language, addresses, work and school, background.",
    nxIds: "Type the ID numbers", nxIdsD: "UCI, PR card and passport. Only you enter these.",
    nxPrCard: "Add her PR card or COPR", nxPrCardD: "Front and back of the card.",
    nxPassport: "Photograph every passport page", nxPassportD: "Every passport she held in the last 5 years, all pages.",
    nxLang: "Add her language proof", nxLangD: "Test results, or a diploma or transcript from study in English or French.",
    nxId2: "Add a second ID", nxId2D: "BC Services Card or driver's licence, front and back.",
    nxOnline: "Fill in the online application", nxOnlineD: "Create her account, do the presence calculation, upload, sign.",
    nxSubmit: "Sign and pay", nxSubmitD: "Sign on the same date as the presence calculation, then pay $653.",
    nxAfter: "Watch for the test invitation", nxAfterD: "IRCC sends it after the application is checked.",
    allDone: "Everything is done. Keep the IRCC confirmation safe.",
    notEligibleYet: "Not eligible yet: {date}",
    // gaps
    gapsTitle: "Fill the gaps",
    gapsLede: "Answers save automatically and stay encrypted. If you're not sure about something, tick \"Not sure\" and Claude will follow up.",
    notSure: "Not sure", yes: "Yes", no: "No", details: "Details",
    nextGroup: "Next section", prevGroup: "Back", allAnswered: "All sections answered",
    jalaliEnter: "Persian date", jalaliUse: "Use this date", jalaliYear: "سال", jalaliMonth: "ماه", jalaliDay: "روز",
    jalaliBad: "That Persian date doesn't exist. Check the numbers.",
    addRow: "Add a period", addTrip: "Add a trip", addAddr: "Add an address", done: "Done", months: "{n} months", present: "to now",
    from: "From", to: "To", activity: "Job, school or activity", employer: "Employer or school", city: "City", country: "Country",
    street: "Street address", province: "Province or state",
    left: "Left Canada", back: "Came back", where: "Where she went", why: "Reason", awayN: "{n} days away", status: "Her status",
    daysN: "{n} days", noTripsLbl: "She hasn't left Canada in the last 5 years",
    coverage: "Coverage, last 5 years", gapFound: "Missing period: {from} to {to}", noGaps: "No gaps. Every month is covered.",
    rowBad: "Check the dates: the return is before the departure.",
    copy: "Copy", copied: "Copied",
    // docs
    docsTitle: "Documents",
    docsLede: "Drop files on a box, choose them, or take a photo with your phone. Each file is encrypted before upload.",
    choose: "Choose files", takePhoto: "Take photo", dropHere: "Drop files here",
    needed: "Needed", ready: "Ready", optional: "Optional", fromClaude: "From Claude",
    buildPdf: "Combine into one PDF", rebuildPdf: "Rebuild the PDF", pdfReady: "Combined passport PDF",
    pages: "{n} pages", page1: "1 page", building: "Building PDF…",
    view: "View", download: "Download", remove: "Delete", confirmRemove: "Tap again to delete", close: "Close",
    photoChecks: "Photo check", pcSize: "At least 420 × 540 pixels", pcShape: "Portrait shape (35 × 45)", pcFile: "File under 4 MB", pcFace: "Head 31–36 mm on a 45 mm photo (69–80% of its height)",
    photoSpecs: "IRCC photo rules",
    encrypting: "Encrypting {name}…", uploaded: "Saved {name}", uploadFail: "Couldn't save {name}: {why}",
    badType: "only photos (JPG, PNG) or PDFs work here", badHeic: "this is an iPhone HEIC photo, which this browser can't read. Upload it from the iPhone, or use Safari on the Mac", pdfTooBig: "This PDF is {size}. IRCC accepts up to 4 MB per file, so it needs to be smaller before uploading there", badImage: "this image format can't be read. Export it as JPG and try again",
    // notes
    notesTitle: "Notes & paste",
    notesLede: "Paste or type anything Claude should know: dates, answers, text from emails, screenshots. Claude reads these the next time you export.",
    pasteHint: "Press {key} anywhere on this site to paste text or a screenshot.",
    notePh: "e.g. She landed as a PR at YVR on 2022-08-15. Trip to Istanbul from 2024-03-02 to 2024-03-20…",
    saveNote: "Save note", noteSaved: "Note saved", attach: "Attach images",
    noNotes: "No notes yet. Your first note will appear here.",
    noteNoFa: "The Farsi version of this note isn't ready yet.",
    fromYou: "From you", fromClaudeNote: "From Claude", seen: "Read by Claude", unread: "New",
    pastedImage: "Pasted image saved to Documents → Anything else",
    // apply
    submitTitle: "Apply",
    submitLede: "The steps on IRCC's online citizenship application. Tick each one as she finishes it.",
    ck_account: "Create her online citizenship account", ck_accountD: "Sign in with GCKey or a bank sign-in and start an adult application.",
    ck_calc: "Do the physical presence calculation", ck_calcD: "Inside the account. Use the trips from Fill the gaps. The calculation date must match the signing date.",
    ck_fill: "Fill in the application", ck_fillD: "Copy answers and ID numbers from this site.",
    ck_prCard: "PR card or COPR ready", ck_prCardD: "Documents → PR card.",
    ck_passport: "Passport PDF ready", ck_passportD: "All pages of every passport from the last 5 years.",
    ck_lang: "Language proof ready", ck_langD: "Documents → Language proof.",
    ck_upload: "Upload the documents", ck_uploadD: "Follow the account's document list.",
    ck_sign: "Sign electronically", ck_signD: "On the same date as the presence calculation.",
    ck_paid: "Pay $653 by card", ck_paidD: "Processing fee plus right of citizenship fee.",
    ck_confirm: "Save the confirmation and receipt", ck_confirmD: "Upload them to Documents → IRCC confirmation.",
    ck_test: "Take the citizenship test", ck_testD: "IRCC sends an invitation. Study with the Discover Canada guide.",
    ck_oath: "Take the oath", ck_oathD: "The final step. She becomes a citizen at the ceremony.",
    auto: "auto",
    claudeTitle: "Keep Claude in the loop",
    claudeBody: "Claude can't log in here. To share new answers and files, export an encrypted copy and tell Claude. Claude sends changes back as an update file.",
    exportBtn: "Export for Claude", importBtn: "Import update from Claude",
    exporting: "Preparing export ({n} of {total})…", exported: "Export downloaded. Tell Claude: \"I exported the case.\"",
    imported: "Update from Claude applied", importBad: "That file doesn't belong to this vault.",
    vaultTitle: "This vault",
    vaultMode: "Storage", vaultModeLocal: "This browser (test mode)", forget: "Forget this device", forgotten: "This device will ask for the storage token next time.",
    idleLocked: "Locked after 20 minutes without activity.",
    // setup
    setupTitle: "Connect private storage",
    setupLede: "One-time setup. The site stores everything, encrypted, in a private GitHub repository.",
    setupRepo: "Private repository", setupRepoHint: "owner/name of the PRIVATE repo, e.g. amirsamanf/nasrinjalili-vault",
    setupSite: "This site's repository", setupSiteHint: "owner/name of the PUBLIC repo that hosts this page",
    setupToken: "Access token", setupTokenHint: "Fine-grained token with Contents: Read and write on both repositories.",
    makeToken: "Create a token on GitHub",
    setupGo: "Connect", setupChecking: "Checking access…",
    setupNotPrivate: "That repository is public. Make it private on GitHub first, then connect again.",
    setupNoAccess: "The token can't reach {repo}. Make sure it includes that repository with Contents: Read and write.",
    setupBadToken: "GitHub refused the token. Generate a new one, copy it with the copy button next to it, and paste it into an empty box. A fine-grained token is 93 characters",
    setupNotToken: "That isn't a GitHub token. Tokens start with github_pat_ (what's in the box is {n} characters). Clear the box and paste the token again.",
    setupRepoBad: "Write repositories as owner/name, for example amirsamanf/nasrinjalili-vault.",
    seedTitle: "Load the starter file",
    seedLede: "Choose vault-seed.nasrin from the computer. It holds everything gathered so far, already encrypted.",
    seedChoose: "Choose vault-seed.nasrin", seedLoading: "Uploading {n} of {total}…",
    seedDone: "All set. Opening the vault…",
    connected: "Connected to {repo}",
    tokenExpired: "The GitHub access token has expired, so the vault can't be opened. Create a new token (button below), paste it here and click Connect. Your data is safe.",
  },
  fa: {
    brand: "صندوق پرونده",
    vaultSub: "صندوق امن پرونده",
    unlockSub: "برای باز کردن پرونده رمزگذاری‌شده وارد شوید.",
    username: "نام کاربری", password: "رمز عبور", show: "نمایش", hide: "پنهان",
    unlock: "ورود", unlocking: "در حال باز کردن…",
    wrong: "نام کاربری یا رمز عبور درست نیست. دوباره با دقت وارد کنید.",
    gateFoot: "همه‌چیز پیش از ذخیره روی همین دستگاه رمزگذاری می‌شود. بدون رمز عبور، هیچ‌کس، حتی گیت‌هاب، نمی‌تواند آن را بخواند.",
    noVault: "این سایت هنوز راه‌اندازی نشده است.",
    lock: "قفل", theme: "پوسته",
    saved: "رمزگذاری و ذخیره شد", saving: "در حال ذخیره…", offline: "ذخیره نشد · تلاش دوباره", pending: "به‌زودی ذخیره می‌شود…", local: "حالت آزمایشی · فقط این مرورگر",
    tabOverview: "خلاصه", tabGaps: "تکمیل اطلاعات", tabDocs: "مدارک", tabNotes: "یادداشت‌ها", tabSubmit: "درخواست",
    progress: "پیشرفت",
    caseTitle: "شهروندی کانادا",
    presence: "حضور فیزیکی", ofDays: "از {need} روز", eligibleNow: "اکنون واجد شرایط است", eligibleOn: "واجد شرایط از {date}",
    eligibleOnD: "به شرط اینکه تا آن زمان در کانادا بماند.", eligibleNowD: "بر اساس تاریخ‌های واردشده، برای درخواست در {date}.",
    noPrDate: "تاریخ اقامت دائم را وارد کنید تا شمارش شروع شود.",
    prDays: "به‌عنوان مقیم دائم", preDays: "پیش از اقامت دائم (نیم‌روز، حداکثر ۳۶۵)", awayDays: "روزهای خارج از کانادا", windowLbl: "بازه ۵ ساله",
    presenceNote: "این یک برآورد است. محاسبه‌گر IRCC در درخواست آنلاین ملاک است. روز خروج و روز بازگشت جزو روزهای حضور در کانادا حساب می‌شوند.",
    eligPage: "شرایط IRCC", openPortal: "درخواست آنلاین",
    s_eligible: "بررسی شرایط", s_history: "سفرها، نشانی‌ها، کار", s_answers: "سؤالات دیگر", s_ids: "شماره‌های شناسایی",
    s_docs: "مدارک آماده", s_online: "درخواست آنلاین", s_submit: "امضا و پرداخت", s_after: "آزمون و سوگند",
    ovTitle: "وضعیت پرونده",
    ovStatus: "{done} مرحله از ۸ مرحله انجام شده است.",
    ovNextIs: "قدم بعدی:",
    nextTitle: "کارهای بعدی",
    factsTitle: "اطلاعات موجود",
    logTitle: "فعالیت‌های اخیر",
    reqTitle: "شرایط لازم",
    reqBody: "۱٬۰۹۵ روز حضور در کانادا در ۵ سال پیش از درخواست · تسلیم اظهارنامه مالیاتی برای ۳ سال از این ۵ سال · انگلیسی یا فرانسوی در سطح CLB 4 · آزمون شهروندی (۱۸ تا ۵۴ سال).",
    fStatus: "وضعیت", fPassport: "گذرنامه", fTaxes: "اظهارنامه مالیاتی", fLang: "مدرک زبان", fFee: "هزینه", fContact: "تماس",
    prSince: "مقیم دائم از {date}", taxN: "{n} سال از ۵ سال اخیر", taxNeed: "IRCC سه سال از پنج سال را لازم دارد", notYet: "هنوز وارد نشده",
    feeBody: "بزرگسال: هزینه رسیدگی به‌علاوه هزینه حق شهروندی.",
    nxStatus: "تاریخ اقامت دائم و مدت حضور پیش از آن را وارد کنید", nxStatusD: "شمارش روزهای حضور فیزیکی از اینجا شروع می‌شود.",
    nxTrips: "سفرهای خارج از کانادا را فهرست کنید", nxTripsD: "همه سفرهای ۵ سال اخیر با تاریخ خروج و بازگشت.",
    nxAnswers: "به {n} سؤال دیگر پاسخ دهید", nxAnswersD: "مالیات، زبان، نشانی‌ها، کار و تحصیل، سؤالات سابقه.",
    nxIds: "شماره‌های شناسایی را وارد کنید", nxIdsD: "UCI، کارت اقامت دائم و گذرنامه. فقط شما وارد می‌کنید.",
    nxPrCard: "کارت اقامت دائم یا COPR را اضافه کنید", nxPrCardD: "پشت و روی کارت.",
    nxPassport: "از همه صفحات گذرنامه عکس بگیرید", nxPassportD: "همه گذرنامه‌های ۵ سال اخیر، همه صفحات.",
    nxLang: "مدرک زبان را اضافه کنید", nxLangD: "نتیجه آزمون، یا مدرک و ریزنمرات تحصیل به انگلیسی یا فرانسوی.",
    nxId2: "یک کارت شناسایی دوم اضافه کنید", nxId2D: "کارت BC Services یا گواهینامه رانندگی، پشت و رو.",
    nxOnline: "درخواست آنلاین را پر کنید", nxOnlineD: "ساخت حساب، محاسبه حضور، بارگذاری مدارک، امضا.",
    nxSubmit: "امضا و پرداخت", nxSubmitD: "در همان تاریخ محاسبه حضور امضا کنید و ۶۵۳ دلار بپردازید.",
    nxAfter: "منتظر دعوت به آزمون باشید", nxAfterD: "IRCC پس از بررسی درخواست آن را می‌فرستد.",
    allDone: "همه مراحل انجام شد. تأییدیه IRCC را نگه دارید.",
    notEligibleYet: "هنوز واجد شرایط نیست: {date}",
    gapsTitle: "تکمیل اطلاعات",
    gapsLede: "پاسخ‌ها خودکار و رمزگذاری‌شده ذخیره می‌شوند. اگر مطمئن نیستید، «مطمئن نیستم» را بزنید تا Claude پیگیری کند.",
    notSure: "مطمئن نیستم", yes: "بله", no: "خیر", details: "توضیحات",
    nextGroup: "بخش بعد", prevGroup: "قبلی", allAnswered: "همه بخش‌ها پاسخ داده شد",
    jalaliEnter: "تاریخ شمسی", jalaliUse: "ثبت این تاریخ", jalaliYear: "سال", jalaliMonth: "ماه", jalaliDay: "روز",
    jalaliBad: "این تاریخ شمسی وجود ندارد. اعداد را بررسی کنید.",
    addRow: "افزودن دوره", addTrip: "افزودن سفر", addAddr: "افزودن نشانی", done: "تمام", months: "{n} ماه", present: "تا اکنون",
    from: "از", to: "تا", activity: "شغل، تحصیل یا فعالیت", employer: "کارفرما یا مؤسسه", city: "شهر", country: "کشور",
    street: "نشانی خیابان", province: "استان یا ایالت",
    left: "خروج از کانادا", back: "بازگشت", where: "مقصد", why: "دلیل", awayN: "{n} روز خارج", status: "وضعیت اقامت",
    daysN: "{n} روز", noTripsLbl: "در ۵ سال اخیر از کانادا خارج نشده است",
    coverage: "پوشش ۵ سال اخیر", gapFound: "دوره خالی: {from} تا {to}", noGaps: "بدون فاصله. همه ماه‌ها پوشش داده شده است.",
    rowBad: "تاریخ‌ها را بررسی کنید: بازگشت پیش از خروج است.",
    copy: "کپی", copied: "کپی شد",
    docsTitle: "مدارک",
    docsLede: "فایل را روی کادر بکشید، انتخاب کنید یا با گوشی عکس بگیرید. هر فایل پیش از بارگذاری رمزگذاری می‌شود.",
    choose: "انتخاب فایل", takePhoto: "عکس گرفتن", dropHere: "فایل‌ها را اینجا رها کنید",
    needed: "لازم", ready: "آماده", optional: "اختیاری", fromClaude: "از طرف Claude",
    buildPdf: "ساخت یک فایل PDF", rebuildPdf: "ساخت دوباره PDF", pdfReady: "PDF کامل گذرنامه",
    pages: "{n} صفحه", page1: "۱ صفحه", building: "در حال ساخت PDF…",
    view: "نمایش", download: "دانلود", remove: "حذف", confirmRemove: "برای حذف دوباره بزنید", close: "بستن",
    photoChecks: "بررسی عکس", pcSize: "دست‌کم ۴۲۰ × ۵۴۰ پیکسل", pcShape: "عمودی (۳۵ × ۴۵)", pcFile: "کمتر از ۴ مگابایت", pcFace: "سر ۳۱ تا ۳۶ میلی‌متر در عکس ۴۵ میلی‌متری (۶۹ تا ۸۰ درصد ارتفاع)",
    photoSpecs: "قوانین عکس IRCC",
    encrypting: "در حال رمزگذاری {name}…", uploaded: "{name} ذخیره شد", uploadFail: "{name} ذخیره نشد: {why}",
    badType: "فقط عکس (JPG، PNG) یا PDF", badHeic: "این عکس HEIC آیفون است و این مرورگر آن را نمی‌خواند. از خود آیفون بارگذاری کنید یا در مک از Safari استفاده کنید", pdfTooBig: "حجم این PDF {size} است. IRCC برای هر فایل تا ۴ مگابایت می‌پذیرد، پس پیش از بارگذاری در آنجا باید کوچک‌تر شود", badImage: "این قالب عکس خوانده نمی‌شود. آن را JPG کنید",
    notesTitle: "یادداشت‌ها",
    notesLede: "هر چیزی که Claude باید بداند را بنویسید یا بچسبانید: تاریخ‌ها، پاسخ‌ها، متن ایمیل، تصویر صفحه. Claude آن‌ها را در خروجی بعدی می‌خواند.",
    pasteHint: "در هر جای سایت {key} را بزنید تا متن یا تصویر چسبانده شود.",
    notePh: "مثلاً: ورود به‌عنوان مقیم دائم در فرودگاه ونکوور، ۲۴ مرداد ۱۴۰۱. سفر به استانبول از ۱۲ اسفند تا ۳۰ اسفند…",
    saveNote: "ذخیره یادداشت", noteSaved: "یادداشت ذخیره شد", attach: "پیوست عکس",
    noNotes: "هنوز یادداشتی نیست.",
    noteNoFa: "ترجمه فارسی این یادداشت هنوز آماده نیست.",
    fromYou: "از شما", fromClaudeNote: "از Claude", seen: "خوانده شد", unread: "جدید",
    pastedImage: "تصویر در «مدارک ← سایر» ذخیره شد",
    submitTitle: "درخواست",
    submitLede: "مراحل درخواست آنلاین شهروندی در سایت IRCC. هر مرحله را پس از انجام تیک بزنید.",
    ck_account: "ساخت حساب آنلاین شهروندی", ck_accountD: "با GCKey یا ورود بانکی وارد شوید و درخواست بزرگسال را شروع کنید.",
    ck_calc: "محاسبه حضور فیزیکی", ck_calcD: "داخل حساب. سفرها را از «تکمیل اطلاعات» بردارید. تاریخ محاسبه باید با تاریخ امضا یکی باشد.",
    ck_fill: "پر کردن درخواست", ck_fillD: "پاسخ‌ها و شماره‌ها را از این سایت کپی کنید.",
    ck_prCard: "کارت اقامت دائم یا COPR آماده", ck_prCardD: "مدارک ← کارت اقامت دائم.",
    ck_passport: "PDF گذرنامه آماده", ck_passportD: "همه صفحات همه گذرنامه‌های ۵ سال اخیر.",
    ck_lang: "مدرک زبان آماده", ck_langD: "مدارک ← مدرک زبان.",
    ck_upload: "بارگذاری مدارک", ck_uploadD: "طبق فهرست مدارک داخل حساب.",
    ck_sign: "امضای الکترونیکی", ck_signD: "در همان تاریخ محاسبه حضور.",
    ck_paid: "پرداخت ۶۵۳ دلار با کارت", ck_paidD: "هزینه رسیدگی به‌علاوه هزینه حق شهروندی.",
    ck_confirm: "ذخیره تأییدیه و رسید", ck_confirmD: "در مدارک ← تأییدیه IRCC بارگذاری کنید.",
    ck_test: "آزمون شهروندی", ck_testD: "IRCC دعوت‌نامه می‌فرستد. با کتاب Discover Canada آماده شوید.",
    ck_oath: "ادای سوگند", ck_oathD: "آخرین مرحله. در مراسم، شهروند می‌شود.",
    auto: "خودکار",
    claudeTitle: "در جریان گذاشتن Claude",
    claudeBody: "Claude نمی‌تواند وارد این سایت شود. برای ارسال پاسخ‌ها و فایل‌های جدید، یک نسخه رمزگذاری‌شده خروجی بگیرید و به Claude بگویید. Claude تغییرات را با یک فایل به‌روزرسانی برمی‌گرداند.",
    exportBtn: "خروجی برای Claude", importBtn: "وارد کردن به‌روزرسانی Claude",
    exporting: "آماده‌سازی خروجی ({n} از {total})…", exported: "خروجی دانلود شد. به Claude بگویید: «خروجی گرفتم».",
    imported: "به‌روزرسانی Claude اعمال شد", importBad: "این فایل مربوط به این صندوق نیست.",
    vaultTitle: "این صندوق",
    vaultMode: "محل ذخیره", vaultModeLocal: "همین مرورگر (آزمایشی)", forget: "فراموش کردن این دستگاه", forgotten: "دفعه بعد توکن دوباره پرسیده می‌شود.",
    idleLocked: "پس از ۲۰ دقیقه بی‌فعالیتی قفل شد.",
    setupTitle: "اتصال به محل ذخیره خصوصی",
    setupLede: "راه‌اندازی یک‌باره. همه‌چیز رمزگذاری‌شده در یک مخزن خصوصی گیت‌هاب ذخیره می‌شود.",
    setupRepo: "مخزن خصوصی", setupRepoHint: "نام مخزن خصوصی، مثلاً amirsamanf/nasrinjalili-vault",
    setupSite: "مخزن این سایت", setupSiteHint: "نام مخزن عمومی که این صفحه را میزبانی می‌کند",
    setupToken: "توکن دسترسی", setupTokenHint: "توکن fine-grained با دسترسی Contents: Read and write به هر دو مخزن.",
    makeToken: "ساخت توکن در گیت‌هاب",
    setupGo: "اتصال", setupChecking: "در حال بررسی دسترسی…",
    setupNotPrivate: "این مخزن عمومی است. ابتدا آن را خصوصی کنید.",
    setupNoAccess: "توکن به {repo} دسترسی ندارد.",
    setupBadToken: "گیت‌هاب توکن را نپذیرفت. یک توکن تازه بسازید، با دکمه کپی کنار آن کپی کنید و در کادر خالی بچسبانید. توکن ۹۳ نویسه دارد",
    setupNotToken: "این توکن گیت‌هاب نیست. توکن با github_pat_ شروع می‌شود (محتوای کادر {n} نویسه است). کادر را خالی کنید و دوباره بچسبانید.",
    setupRepoBad: "نام مخزن را به شکل owner/name بنویسید، مثلاً amirsamanf/nasrinjalili-vault.",
    seedTitle: "بارگذاری فایل آغازین",
    seedLede: "فایل vault-seed.nasrin را از رایانه انتخاب کنید.",
    seedChoose: "انتخاب vault-seed.nasrin", seedLoading: "در حال بارگذاری {n} از {total}…",
    seedDone: "انجام شد. در حال باز کردن…",
    connected: "متصل به {repo}",
    tokenExpired: "توکن دسترسی گیت‌هاب منقضی شده و صندوق باز نمی‌شود. یک توکن تازه بسازید (دکمه پایین)، اینجا بچسبانید و «اتصال» را بزنید. اطلاعات شما امن است.",
  },
};

let LANG = store.get("nasrin.lang") === "fa" ? "fa" : "en";
// Fills {tokens} from the decrypted case (never from this public file).
function fill(s) {
  if (!S?.data || typeof s !== "string" || !s.includes("{")) return s;
  const p = S.data.profile;
  const map = { name: p.givenName || "" };
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}
const t = (k, vars) => {
  let s = (T[LANG] && T[LANG][k]) ?? T.en[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll("{" + a + "}", b);
  return fill(s);
};
const L = (o) => fill(o ? o[LANG] ?? o.en : "");
const faDigits = (s) => (LANG === "fa" ? String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]) : String(s));

/* ====================================================================== */
/* icons                                                                   */
/* ====================================================================== */
const P = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  lock: "M7 11V8a5 5 0 0110 0v3M5.5 11h13v9.5h-13z",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z M8.8 12l2.2 2.2 4.2-4.4",
  upload: "M12 16V4M7 9l5-5 5 5M4.5 15v4.5h15V15",
  camera: "M4 8h3.5l1.8-2.5h5.4L16.5 8H20v11H4z M12 16.5a3.3 3.3 0 100-6.6 3.3 3.3 0 000 6.6",
  file: "M6.5 3h7.5l4.5 4.5V21h-12z M13.5 3v5h5",
  arrow: "M9 5l7 7-7 7",
  alert: "M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  download: "M12 4v12M7 11l5 5 5-5M4.5 19.5h15",
  trash: "M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13",
  x: "M6 6l12 12M18 6L6 18",
  copy: "M8 8h11v12H8z M5 16V4h11",
  sun: "M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  moon: "M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z",
  note: "M5 4h14v11l-5 5H5z M14 20v-5h5",
  pen: "M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4",
  id: "M3.5 5.5h17v13h-17z M7 10h4M7 13.5h6M15.5 9.5h2",
  pdf: "M6.5 3h7.5l4.5 4.5V21h-12z M13.5 3v5h5 M8.5 13h1.8a1.3 1.3 0 010 2.6H8.5V13zm0 2.6V18 M13 13v5h1.2a2.5 2.5 0 000-5z",
  plus: "M12 5v14M5 12h14",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  send: "M4 12l16-8-6 16-2.5-6.5z",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z",
  passport: "M6 3h12v18H6z M12 8.5a3 3 0 100 6 3 3 0 000-6z M9 17.5h6",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3.5V7 M16 3.5V7",
};
const ic = (name, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${P[name]}"/></svg>`;

/* ====================================================================== */
/* helpers                                                                 */
/* ====================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowISO = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtDate(iso, opts = {}) {
  if (!iso) return "";
  const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00Z" : iso);
  if (isNaN(d)) return iso;
  const g = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", ...opts }).format(d);
  if (LANG !== "fa") return g;
  const j = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d);
  return `${j} <span class="muted small">(${g})</span>`;
}
function fmtStamp(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(LANG === "fa" ? "fa-IR" : "en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function fmtSize(n) {
  return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
}
const persianFmt = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
function persianParts(d) {
  const p = persianFmt.formatToParts(d);
  const g = (ty) => Number(p.find((x) => x.type === ty)?.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}
function jalaliToISO(jy, jm, jd) {
  if (!(jy > 1200 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31)) return null;
  const base = Date.UTC(jy + 621, 2, 21, 12);
  const off = (jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + (jd - 1);
  for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
    const dt = new Date(base + (off + delta) * 864e5);
    const p = persianParts(dt);
    if (p.y === jy && p.m === jm && p.d === jd) return dt.toISOString().slice(0, 10);
  }
  return null;
}
function jalaliLabel(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d);
}
function todayISO() {
  return new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
}
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function daysLeft() {
  // Deadline = midnight Pacific at the start of the permit's expiry day (08:00 UTC in PST).
  const iso = S.data?.application?.deadline || S.data?.profile?.permit?.expires;
  if (!iso) return 0;
  return Math.max(0, Math.ceil((Date.parse(iso + "T08:00:00Z") - Date.now()) / 864e5));
}
function workWindowStart() {
  const n = new Date();
  return n.getUTCFullYear() * 12 + n.getUTCMonth() - WORK_YEARS * 12;
}
function monthIndex(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(ym || "");
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}
function ymFromIndex(i) {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/* ====================================================================== */
/* question model                                                          */
/* ====================================================================== */
const YN = "yesno";
const taxYears = () => { const y = new Date().getUTCFullYear(); return [y - 5, y - 4, y - 3, y - 2, y - 1].map(String); };
const GROUPS = [
  {
    id: "status", icon: "id",
    title: { en: "Becoming a permanent resident", fa: "اقامت دائم" },
    intro: { en: "Every day as a permanent resident counts as a full day. Time in Canada before that, as a visitor, student or worker, counts as half a day, up to 365 days.", fa: "هر روز به‌عنوان مقیم دائم یک روز کامل حساب می‌شود. حضور پیش از آن در کانادا (توریست، دانشجو یا کارگر) نیم‌روز حساب می‌شود، حداکثر ۳۶۵ روز." },
    fields: [
      { id: "presence", type: "presence", optional: true },
      { id: "prDate", type: "date", label: { en: "Date she became a permanent resident", fa: "تاریخ اقامت دائم" },
        hint: { en: "On her COPR (\"Date of landing\") or the PR card's \"PR since\" line.", fa: "روی COPR (تاریخ ورود) یا خط «PR since» روی کارت اقامت دائم." } },
      { id: "prCardExpiry", type: "date", future: true, optional: true, label: { en: "PR card expiry date (optional)", fa: "تاریخ انقضای کارت اقامت دائم (اختیاری)" },
        hint: { en: "An expired card is fine for the application.", fa: "کارت منقضی هم برای درخواست قابل قبول است." } },
      { id: "beforePR", type: YN, label: { en: "Did she live in Canada before becoming a PR (as a visitor, student or worker) in the last 5 years?", fa: "آیا در ۵ سال اخیر پیش از اقامت دائم در کانادا زندگی کرده است (توریست، دانشجو یا کارگر)؟" } },
      { id: "prePR", type: "list", when: (a) => a.beforePR === "yes", label: { en: "Her time in Canada before PR", fa: "حضور در کانادا پیش از اقامت دائم" } },
      { id: "planDate", type: "date", future: true, optional: true, label: { en: "Planned application date (optional)", fa: "تاریخ برنامه‌ریزی‌شده برای درخواست (اختیاری)" },
        hint: { en: "Leave empty to count for today. The count looks at the 5 years before this date.", fa: "خالی بگذارید تا برای امروز حساب شود. شمارش ۵ سال پیش از این تاریخ را در نظر می‌گیرد." } },
    ],
  },
  {
    id: "trips", icon: "send",
    title: { en: "Trips outside Canada", fa: "سفرهای خارج از کانادا" },
    intro: { en: "Every trip in the last 5 years, even a day trip to the US. Use passport stamps, boarding passes and flight emails. The day she left and the day she came back count as days in Canada.", fa: "همه سفرهای ۵ سال اخیر، حتی یک روزه به آمریکا. از مهرهای گذرنامه، کارت پرواز و ایمیل‌های پرواز کمک بگیرید. روز خروج و روز بازگشت جزو روزهای حضور در کانادا هستند." },
    fields: [
      { id: "presence", type: "presence", optional: true },
      { id: "trips", type: "list", label: { en: "Trips", fa: "سفرها" } },
    ],
  },
  {
    id: "taxes", icon: "file",
    title: { en: "Taxes", fa: "مالیات" },
    intro: { en: "She must have filed Canadian income taxes for at least 3 of the 5 years before applying, if she had to file. Her CRA My Account shows each year's notice of assessment.", fa: "باید دست‌کم برای ۳ سال از ۵ سال پیش از درخواست، اظهارنامه مالیاتی کانادا داده باشد (اگر ملزم بوده). در حساب CRA هر سال «Notice of assessment» دارد." },
    fields: [
      { id: "taxYears", type: "years", label: { en: "Which years did she file Canadian taxes for?", fa: "برای کدام سال‌ها اظهارنامه مالیاتی کانادا داده است؟" } },
      { id: "sin", type: YN, label: { en: "Does she have a Social Insurance Number (SIN)?", fa: "آیا شماره بیمه اجتماعی (SIN) دارد؟" },
        hint: { en: "The application asks for it. Type the number itself in ID numbers.", fa: "در درخواست پرسیده می‌شود. خود شماره را در بخش شماره‌های شناسایی وارد کنید." } },
    ],
  },
  {
    id: "lang", icon: "globe",
    title: { en: "Language", fa: "زبان" },
    intro: { en: "Applicants aged 18 to 54 must prove English or French speaking and listening at CLB 4 or higher.", fa: "متقاضیان ۱۸ تا ۵۴ سال باید مهارت گفتاری و شنیداری انگلیسی یا فرانسوی را در سطح CLB 4 یا بالاتر ثابت کنند." },
    fields: [
      { id: "langProof", type: "choice", label: { en: "Which proof does she have?", fa: "کدام مدرک را دارد؟" },
        options: [
          ["CELPIP-General", { en: "CELPIP-General", fa: "CELPIP-General" }], ["IELTS General Training", { en: "IELTS General Training", fa: "IELTS General" }],
          ["PTE Core", { en: "PTE Core", fa: "PTE Core" }], ["TEF or TCF", { en: "TEF or TCF (French)", fa: "TEF یا TCF (فرانسوی)" }],
          ["Studied in English or French", { en: "Diploma or degree taught in English or French", fa: "مدرک تحصیلی به زبان انگلیسی یا فرانسوی" }],
          ["LINC or CLIC", { en: "LINC or CLIC certificate (CLB 4+)", fa: "گواهی LINC یا CLIC (CLB 4 به بالا)" }],
          ["none", { en: "Nothing yet", fa: "هنوز ندارد" }]] },
      { id: "langDetail", type: "textarea", when: (a) => a.langProof && a.langProof !== "none",
        label: { en: "Details: test date and scores, or school, program and years", fa: "جزئیات: تاریخ و نمره آزمون، یا نام دانشگاه، رشته و سال‌ها" },
        hint: { en: "Test results must be from an approved test. A degree counts if it was taught in English or French, in Canada or abroad.", fa: "نتیجه آزمون باید از آزمون‌های تأییدشده باشد. مدرک تحصیلی اگر به انگلیسی یا فرانسوی تدریس شده باشد قبول است، در کانادا یا خارج." } },
    ],
  },
  {
    id: "addr", icon: "calendar",
    title: { en: "Addresses", fa: "نشانی‌ها" },
    intro: { en: "Every home address in the last 5 years, with no gaps, newest first. Include addresses outside Canada.", fa: "همه نشانی‌های محل سکونت در ۵ سال اخیر، بدون فاصله. نشانی‌های خارج از کانادا هم لازم است." },
    fields: [{ id: "addrRows", type: "timeline", label: { en: "Addresses", fa: "نشانی‌ها" } }],
  },
  {
    id: "work", icon: "pen",
    title: { en: "Work & school", fa: "کار و تحصیل" },
    intro: { en: "Every month of the last 5 years, with no gaps: jobs, studies, and time looking for work or at home.", fa: "همه ماه‌های ۵ سال اخیر، بدون فاصله: کار، تحصیل، و دوره‌های جستجوی کار یا خانه‌داری." },
    fields: [{ id: "workRows", type: "timeline", label: { en: "Periods", fa: "دوره‌ها" } }],
  },
  {
    id: "police", icon: "shield",
    title: { en: "Police certificates", fa: "گواهی عدم سوء پیشینه" },
    intro: { en: "A police certificate is needed for each country where she spent 183 days or more in a row in the last 4 years, after turning 18.", fa: "برای هر کشوری که در ۴ سال اخیر (پس از ۱۸ سالگی) ۱۸۳ روز یا بیشتر پیوسته در آن بوده، گواهی عدم سوء پیشینه لازم است." },
    fields: [
      { id: "policeAbroad", type: YN, details: true, label: { en: "In the last 4 years, did she spend 183 days or more in a row in any country other than Canada?", fa: "در ۴ سال اخیر، آیا ۱۸۳ روز یا بیشتر پیوسته در کشوری غیر از کانادا بوده است؟" } },
    ],
  },
  {
    id: "bg", icon: "shield",
    title: { en: "Background questions", fa: "سؤالات سابقه" },
    intro: { en: "Answer each one truthfully. Any \"Yes\" needs a short explanation.", fa: "به هر سؤال صادقانه پاسخ دهید. هر «بله» توضیح کوتاهی لازم دارد." },
    fields: [
      { id: "bgCharged", type: YN, details: true, label: { en: "Is she now charged with, on trial for, or appealing a crime, in Canada or elsewhere?", fa: "آیا اکنون در کانادا یا جای دیگر به جرمی متهم است، محاکمه می‌شود یا درخواست تجدیدنظر دارد؟" } },
      { id: "bgConvicted", type: YN, details: true, label: { en: "In the last 4 years, has she been convicted of a crime, in Canada or elsewhere?", fa: "در ۴ سال اخیر، آیا در کانادا یا جای دیگر به جرمی محکوم شده است؟" } },
      { id: "bgPrison", type: YN, details: true, label: { en: "In the last 5 years, has she been in prison, on parole or on probation?", fa: "در ۵ سال اخیر، آیا زندان، آزادی مشروط یا دوره تعلیقی داشته است؟" } },
      { id: "bgRemoval", type: YN, details: true, label: { en: "Has she ever been ordered to leave Canada?", fa: "آیا تا کنون دستور ترک کانادا گرفته است؟" } },
      { id: "bgRefused", type: YN, details: true, label: { en: "Has she ever been refused Canadian citizenship, or had it taken away?", fa: "آیا تا کنون درخواست شهروندی‌اش رد شده یا شهروندی از او گرفته شده است؟" } },
      { id: "bgWar", type: YN, details: true, label: { en: "Is she under investigation for, charged with, or convicted of war crimes or crimes against humanity?", fa: "آیا به جنایت جنگی یا جنایت علیه بشریت متهم، محکوم یا تحت تحقیق است؟" } },
    ],
  },
  {
    id: "contact", icon: "note",
    title: { en: "Personal details", fa: "اطلاعات شخصی" },
    intro: { en: "The application asks for these. Height and eye colour go on the citizenship certificate.", fa: "این موارد در درخواست پرسیده می‌شود. قد و رنگ چشم روی گواهی شهروندی درج می‌شود." },
    fields: [
      { id: "email", type: "text", label: { en: "Her email address", fa: "ایمیل" } },
      { id: "phone", type: "text", label: { en: "Her phone number", fa: "شماره تلفن" } },
      { id: "marital", type: "choice", label: { en: "Marital status", fa: "وضعیت تأهل" },
        options: [["Single", { en: "Single", fa: "مجرد" }], ["Married", { en: "Married", fa: "متأهل" }], ["Common-law", { en: "Common-law", fa: "زندگی مشترک" }], ["Divorced", { en: "Divorced", fa: "مطلقه" }], ["Separated", { en: "Separated", fa: "جدا شده" }], ["Widowed", { en: "Widowed", fa: "همسر فوت‌شده" }]] },
      { id: "otherNames", type: YN, details: true, label: { en: "Has she ever used another name or spelling (a nickname, or a different spelling in old documents)?", fa: "آیا تا کنون نام یا املای دیگری داشته است (نام مستعار، یا املای متفاوت در مدارک قدیمی)؟" } },
      { id: "height", type: "text", label: { en: "Height (cm)", fa: "قد (سانتی‌متر)" } },
      { id: "eyes", type: "choice", label: { en: "Eye colour", fa: "رنگ چشم" },
        options: [["Brown", { en: "Brown", fa: "قهوه‌ای" }], ["Black", { en: "Black", fa: "مشکی" }], ["Hazel", { en: "Hazel", fa: "عسلی" }], ["Green", { en: "Green", fa: "سبز" }], ["Blue", { en: "Blue", fa: "آبی" }], ["Grey", { en: "Grey", fa: "طوسی" }]] },
      { id: "birthPlace", type: "text", label: { en: "Place of birth (city, country)", fa: "محل تولد (شهر، کشور)" } },
    ],
  },
  {
    id: "ids", icon: "id", store: "ids",
    title: { en: "ID numbers", fa: "شماره‌های شناسایی" },
    intro: { en: "Claude never types ID numbers. Enter them here once, then use Copy when filling the online application.", fa: "Claude هرگز شماره‌های شناسایی را وارد نمی‌کند. یک بار اینجا بنویسید و هنگام پر کردن درخواست آنلاین از دکمه کپی استفاده کنید." },
    fields: [
      { id: "uci", type: "id", label: { en: "UCI / client ID (on the PR card)", fa: "شماره UCI (روی کارت اقامت دائم)" } },
      { id: "prCardNumber", type: "id", label: { en: "PR card number", fa: "شماره کارت اقامت دائم" } },
      { id: "passportNumber", type: "id", label: { en: "Current passport number", fa: "شماره گذرنامه فعلی" } },
      { id: "sinNumber", type: "id", optional: true, label: { en: "Social Insurance Number (optional here)", fa: "شماره بیمه اجتماعی (اختیاری)" } },
    ],
  },
];
// Row lists. "timeline" rows are months with a coverage bar; "days" rows are exact dates.
const STATUS_OPTS = [["Visitor", { en: "Visitor", fa: "توریست" }], ["Student", { en: "Student", fa: "دانشجو" }], ["Worker", { en: "Worker", fa: "کارگر" }], ["Protected person", { en: "Protected person", fa: "پناهنده پذیرفته‌شده" }]];
const LISTS = {
  addrRows: { kind: "timeline", add: "addAddr", label: "street", cols: [["street", "full"], ["city"], ["province"], ["country"]] },
  workRows: { kind: "timeline", add: "addRow", label: "activity", cols: [["activity", "full"], ["employer"], ["city"], ["country"]],
    quick: [["Student", "دانشجو"], ["Unemployed", "بیکار"], ["Looking for work", "جستجوی کار"]] },
  trips: { kind: "days", add: "addTrip", a: "left", b: "back", away: true, cols: [["where"], ["why"]] },
  prePR: { kind: "days", add: "addRow", a: "from", b: "to", cols: [["status", STATUS_OPTS]] },
};
const PLACES = [];

const SLOTS = [
  { id: "prCard", req: true, accept: "image/*,application/pdf", multi: true, camera: "environment", icon: "id",
    title: { en: "PR card or COPR", fa: "کارت اقامت دائم یا COPR" },
    desc: { en: "Front and back of the PR card. If the card is lost, her Confirmation of Permanent Residence.", fa: "پشت و روی کارت اقامت دائم. اگر کارت گم شده، تأییدیه اقامت دائم (COPR)." } },
  { id: "passport", req: true, wide: true, accept: "image/*,application/pdf", multi: true, camera: "environment", icon: "passport",
    title: { en: "Passport pages", fa: "صفحات گذرنامه" },
    desc: { en: "Every page of every passport she held in the last 5 years, including blank pages. Combine them into one PDF for IRCC.", fa: "همه صفحات همه گذرنامه‌های ۵ سال اخیر، حتی صفحات خالی. همه را به یک PDF برای IRCC تبدیل کنید." } },
  { id: "language", req: true, accept: "image/*,application/pdf", multi: true, icon: "globe",
    title: { en: "Language proof", fa: "مدرک زبان" },
    desc: { en: "Test results, or a diploma and transcript from study in English or French.", fa: "نتیجه آزمون، یا مدرک و ریزنمرات تحصیل به انگلیسی یا فرانسوی." } },
  { id: "id2", req: true, accept: "image/*,application/pdf", multi: true, camera: "environment", icon: "id",
    title: { en: "Second ID", fa: "کارت شناسایی دوم" },
    desc: { en: "BC Services Card or driver's licence, front and back. It must show her name and date of birth.", fa: "کارت BC Services یا گواهینامه رانندگی، پشت و رو. باید نام و تاریخ تولد را نشان دهد." } },
  { id: "tax", accept: "image/*,application/pdf", multi: true, icon: "file",
    title: { en: "Tax notices of assessment", fa: "برگه‌های ارزیابی مالیاتی" },
    desc: { en: "Optional. Helps Claude check the tax years. IRCC checks with CRA directly.", fa: "اختیاری. به Claude برای بررسی سال‌های مالیاتی کمک می‌کند. IRCC مستقیماً از CRA استعلام می‌کند." } },
  { id: "travel", accept: "image/*,application/pdf", multi: true, icon: "send",
    title: { en: "Travel records", fa: "سوابق سفر" },
    desc: { en: "Optional. Boarding passes, flight emails or a CBSA travel history, to check the trip dates.", fa: "اختیاری. کارت پرواز، ایمیل‌های پرواز یا سابقه سفر CBSA برای بررسی تاریخ سفرها." } },
  { id: "confirmation", accept: "application/pdf,image/*", multi: true, icon: "shield",
    title: { en: "IRCC confirmation & receipt", fa: "تأییدیه و رسید IRCC" },
    desc: { en: "After paying, save the confirmation page and receipt here.", fa: "پس از پرداخت، تأییدیه و رسید را اینجا ذخیره کنید." } },
  { id: "reference", accept: "image/*,application/pdf", multi: true, icon: "file",
    title: { en: "Reference documents", fa: "مدارک مرجع" },
    desc: { en: "Anything Claude prepares or that helps answer questions.", fa: "هر چیزی که Claude آماده می‌کند یا به پاسخ سؤال‌ها کمک می‌کند." } },
  { id: "other", accept: "image/*,application/pdf", multi: true, icon: "plus",
    title: { en: "Anything else", fa: "سایر" },
    desc: { en: "Pasted screenshots and anything Claude should see.", fa: "تصاویر چسبانده‌شده و هر چیزی که Claude باید ببیند." } },
];

/* ====================================================================== */
/* state                                                                   */
/* ====================================================================== */
const S = {
  vault: null, key: null, store: null, mode: IS_LOCAL ? "local" : "github", secretRepo: "",
  data: null, sha: null, pending: [], saving: false, saveState: "saved",
  tab: store.get("nasrin.tab") || "overview", group: "status",
  thumbs: new Map(), armed: null, jalOpen: null, intro: true,
};

/* ====================================================================== */
/* storage backends                                                        */
/* ====================================================================== */
class ApiError extends Error {
  constructor(status, msg) { super(msg || "GitHub error " + status); this.status = status; this.conflict = status === 409 || status === 422; }
}
class GitHubStore {
  constructor({ token, repo, branch }) { this.token = token; this.repo = repo; this.branch = branch || null; }
  async req(repo, path, { method = "GET", body, raw = false } = {}) {
    const url = `${API}/repos/${repo}/contents/${path}` + (method === "GET" && this.branch ? `?ref=${encodeURIComponent(this.branch)}` : "");
    const r = await fetch(url, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${this.token}`, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r;
  }
  async readCase() {
    const r = await this.req(this.repo, "data/case.lps");
    if (r.status === 404) return null;
    if (!r.ok) throw new ApiError(r.status);
    const j = await r.json();
    let bytes = j.content && j.encoding === "base64" ? fromB64(j.content) : null;
    if (!bytes || !bytes.length) {
      const rr = await this.req(this.repo, "data/case.lps", { raw: true });
      if (!rr.ok) throw new ApiError(rr.status);
      bytes = new Uint8Array(await rr.arrayBuffer());
    }
    return { bytes, sha: j.sha };
  }
  async put(repo, path, bytes, sha) {
    const body = { message: "vault update", content: toB64(bytes) };
    if (sha) body.sha = sha;
    if (this.branch) body.branch = this.branch;
    const r = await this.req(repo, path, { method: "PUT", body });
    if (!r.ok) throw new ApiError(r.status);
    return (await r.json()).content.sha;
  }
  writeCase(bytes, sha) { return this.put(this.repo, "data/case.lps", bytes, sha); }
  async readFile(id) {
    const r = await this.req(this.repo, `files/${id}.lps`, { raw: true });
    if (!r.ok) throw new ApiError(r.status);
    return new Uint8Array(await r.arrayBuffer());
  }
  writeFile(id, bytes) { return this.put(this.repo, `files/${id}.lps`, bytes, null); }
  async deleteFile(id, sha) {
    if (!sha) {
      const m = await this.req(this.repo, `files/${id}.lps`);
      if (m.status === 404) return;
      sha = (await m.json()).sha;
    }
    const body = { message: "vault update", sha };
    if (this.branch) body.branch = this.branch;
    const r = await this.req(this.repo, `files/${id}.lps`, { method: "DELETE", body });
    if (!r.ok && r.status !== 404) throw new ApiError(r.status);
  }
}
class LocalStore {
  async db() {
    if (this._db) return this._db;
    this._db = await new Promise((res, rej) => {
      const r = indexedDB.open("nasrin-test", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._db;
  }
  async op(mode, fn) {
    const db = await this.db();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", mode);
      const rq = fn(tx.objectStore("kv"));
      tx.oncomplete = () => res(rq?.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  get(k) { return this.op("readonly", (s) => s.get(k)); }
  set(k, v) { return this.op("readwrite", (s) => s.put(v, k)); }
  del(k) { return this.op("readwrite", (s) => s.delete(k)); }
  async readCase() { const v = await this.get("case"); return v ? { bytes: v.bytes, sha: v.sha } : null; }
  async writeCase(bytes, sha) {
    const cur = await this.get("case");
    if (cur && cur.sha !== sha) throw new ApiError(409);
    const ns = randomId("s");
    await this.set("case", { bytes, sha: ns });
    return ns;
  }
  async readFile(id) { const v = await this.get("f:" + id); if (!v) throw new ApiError(404); return v; }
  async writeFile(id, bytes) { await this.set("f:" + id, bytes); return "local"; }
  async deleteFile(id) { await this.del("f:" + id); }
}

/* ====================================================================== */
/* vault loading + unlock                                                  */
/* ====================================================================== */
function guessSiteRepo() {
  const h = location.hostname;
  if (!h.endsWith(".github.io")) return "";
  const owner = h.split(".")[0];
  const seg = location.pathname.split("/").filter(Boolean)[0];
  return seg && !seg.includes(".") ? `${owner}/${seg}` : `${owner}/${h}`;
}
async function loadVault() {
  const r = await fetch("vault.json", { cache: "no-store" });
  if (!r.ok) throw new Error("no-vault");
  return r.json();
}
async function freshVaultFromApi() {
  const repo = guessSiteRepo();
  if (!repo) return null;
  try {
    const r = await fetch(`${API}/repos/${repo}/contents/vault.json`, { cache: "no-store", headers: { Accept: "application/vnd.github.raw+json" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function doUnlock(user, pass) {
  S.key = await unlockVault(S.vault, user, pass);
  if (IS_LOCAL) {
    S.store = new LocalStore();
  } else {
    let sealed = S.vault.secret || store.get("nasrin.secret");
    if (!sealed) {
      const fresh = await freshVaultFromApi();
      if (fresh?.secret) { S.vault = fresh; sealed = fresh.secret; }
    }
    if (!sealed) return renderSetup();
    const secret = await openJSON(S.key, fromB64(sealed));
    store.set("nasrin.secret", sealed);
    S.store = new GitHubStore(secret);
    S.secretRepo = secret.repo;
  }
  let got;
  try {
    got = await S.store.readCase();
  } catch (e) {
    // An expired or revoked token: ask for a new one instead of stopping at "GitHub error 401".
    if (!IS_LOCAL && (e.status === 401 || e.status === 403)) return renderSetup(1, t("tokenExpired"));
    throw e;
  }
  if (!got) return renderSetup(2);
  S.data = await openJSON(S.key, got.bytes);
  S.sha = got.sha;
  normalize();
  startApp();
}
function normalize() {
  const d = S.data;
  d.answers ??= {}; d.ids ??= {}; d.checklist ??= {}; d.notes ??= []; d.files ??= []; d.log ??= [];
  for (const k of Object.keys(LISTS)) if (!Array.isArray(d.answers[k])) d.answers[k] = [];
}

/* ====================================================================== */
/* saving                                                                  */
/* ====================================================================== */
let saveTimer = 0;
function mutate(fn, { render = true, log } = {}) {
  const wrapped = (d) => {
    fn(d);
    if (log) d.log.unshift({ at: nowISO(), by: "you", text: log });
    if (d.log.length > 60) d.log.length = 60;
  };
  wrapped(S.data);
  S.pending.push(wrapped);
  S.saveState = "pending";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 900);
  if (render) renderMain(); else refreshChrome();
}
async function saveNow() {
  if (S.saving) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); return; }
  if (!S.pending.length) return;
  S.saving = true;
  S.saveState = "saving"; renderTop();
  const fns = S.pending.splice(0);
  try {
    S.data.rev = (S.data.rev || 0) + 1;
    S.data.updatedAt = nowISO();
    try {
      S.sha = await S.store.writeCase(await sealJSON(S.key, S.data), S.sha);
    } catch (e) {
      if (!e.conflict) throw e;
      const remote = await S.store.readCase();
      const rd = await openJSON(S.key, remote.bytes);
      S.data = rd; normalize();
      for (const f of fns) f(S.data);
      S.data.rev = (rd.rev || 0) + 1;
      S.data.updatedAt = nowISO();
      S.sha = await S.store.writeCase(await sealJSON(S.key, S.data), remote.sha);
      renderMain();
    }
    S.saveState = "saved";
  } catch (e) {
    console.warn("save failed", e);
    S.pending.unshift(...fns);
    S.saveState = "offline";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 8000);
  } finally {
    S.saving = false;
    renderTop();
    if (S.pending.length && S.saveState !== "offline") { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
  }
}
window.addEventListener("beforeunload", (e) => {
  if (S.pending.length || S.saving) { e.preventDefault(); e.returnValue = ""; }
});

/* ====================================================================== */
/* derived status                                                          */
/* ====================================================================== */
const getVal = (g, f) => (g.store === "ids" ? S.data.ids[f.id] : S.data.answers[f.id]);
function visible(f) { return !f.when || f.when(S.data.answers); }
const ROWLESS = new Set(["presence", "list", "timeline"]);
function fieldDone(g, f) {
  if (!visible(f) || f.optional) return true;
  const a = g.store === "ids" ? S.data.ids : S.data.answers;
  if (!ROWLESS.has(f.type) && a[f.id + "Unsure"]) return true;
  const v = a[f.id];
  if (f.type === "timeline") return timelineStatus(f.id).done;
  if (f.type === "list") return listStatus(f.id).done;
  if (f.type === "years") return Array.isArray(v) && v.length > 0;
  if (f.type === YN && f.details && v === "yes") return !!String(a[f.id + "Detail"] || "").trim();
  return v !== undefined && v !== null && String(v).trim() !== "";
}
function groupStatus(g) {
  const fs = g.fields.filter((f) => visible(f) && !f.optional);
  const done = fs.filter((f) => fieldDone(g, f)).length;
  return { done, total: fs.length, complete: done === fs.length };
}
const groupById = (id) => GROUPS.find((g) => g.id === id);
const groupDone = (id) => groupStatus(groupById(id)).complete;
function openQuestions(includeIds = false, skip = []) {
  let n = 0;
  for (const g of GROUPS) {
    if ((g.id === "ids" && !includeIds) || skip.includes(g.id)) continue;
    const s = groupStatus(g);
    n += s.total - s.done;
  }
  return n;
}
// Months covered by a timeline list (addresses, work), over the last WORK_YEARS years.
function timelineStatus(list) {
  const rows = S.data.answers[list] || [];
  const label = LISTS[list].label;
  const start = workWindowStart();
  const now = new Date();
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const covered = new Array(end - start + 1).fill(false);
  let rowsOk = rows.length > 0;
  for (const r of rows) {
    const a = monthIndex(r.from);
    const b = r.present ? end : monthIndex(r.to);
    if (a == null || b == null || !String(r[label] || "").trim()) { rowsOk = false; continue; }
    for (let i = Math.max(a, start); i <= Math.min(b, end); i++) covered[i - start] = true;
  }
  const gaps = [];
  let i = 0;
  while (i < covered.length) {
    if (!covered[i]) { let j = i; while (j + 1 < covered.length && !covered[j + 1]) j++; gaps.push([ymFromIndex(start + i), ymFromIndex(start + j)]); i = j + 1; } else i++;
  }
  return { covered, gaps, start, end, done: rowsOk && gaps.length === 0 };
}
/* ---------- exact days ---------- */
const DAY = 864e5;
const dnum = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? Math.round(Date.parse(iso + "T00:00:00Z") / DAY) : null);
const diso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
function minusYears(n, y) { const d = new Date(n * DAY); d.setUTCFullYear(d.getUTCFullYear() - y); return Math.round(d.getTime() / DAY); }
function rowDays(list, r) {
  const c = LISTS[list];
  const a = dnum(r[c.a]), b = dnum(r[c.b]);
  if (a == null || b == null) return null;
  if (b < a) return -1;
  return c.away ? Math.max(0, b - a - 1) : b - a + 1;
}
function listStatus(list) {
  const rows = S.data.answers[list] || [];
  if (list === "trips" && S.data.answers.noTrips) return { done: true, none: true };
  const ok = rows.length > 0 && rows.every((r) => { const n = rowDays(list, r); return n != null && n >= 0; });
  return { done: ok };
}
// Physical presence, as IRCC counts it: full days as a PR, half days before PR (max 365 credit), over the
// 5 years before the application date. Leaving and returning days count as days in Canada. Days after today
// are assumed to be in Canada unless a trip covers them.
function presence() {
  const a = S.data.answers;
  const pr = dnum(a.prDate);
  if (pr == null) return null;
  const today = dnum(todayISO());
  const app = dnum(a.planDate) ?? today;
  const lo = minusYears(Math.min(app, today), 5) - 1;
  const hi = Math.max(app, today) + 5 * 366;
  const N = hi - lo;
  const away = new Uint8Array(N), pre = new Uint8Array(N);
  const mark = (arr, x, y) => { for (let d = Math.max(x, lo); d <= Math.min(y, hi - 1); d++) arr[d - lo] = 1; };
  for (const r of a.trips || []) { const l = dnum(r.left), b = dnum(r.back); if (l != null && b != null && b > l + 1) mark(away, l + 1, b - 1); }
  if (a.beforePR === "yes") for (const r of a.prePR || []) { const f = dnum(r.from), t = dnum(r.to); if (f != null && t != null && t >= f) mark(pre, f, Math.min(t, pr - 1)); }
  const fullP = new Float64Array(N + 1), halfP = new Float64Array(N + 1), awayP = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const d = lo + i;
    fullP[i + 1] = fullP[i] + (d >= pr && !away[i] ? 1 : 0);
    halfP[i + 1] = halfP[i] + (d < pr && pre[i] && !away[i] ? 0.5 : 0);
    awayP[i + 1] = awayP[i] + (away[i] ? 1 : 0);
  }
  const calc = (A) => {
    const s = minusYears(A, 5) - lo, e = A - lo;
    const full = fullP[e] - fullP[s], credit = Math.min(365, halfP[e] - halfP[s]);
    return { full, credit, away: awayP[e] - awayP[s], total: Math.floor(full + credit), start: minusYears(A, 5) };
  };
  const cur = calc(app);
  let eligibleOn = cur.total >= NEED_DAYS ? app : null;
  if (eligibleOn == null) for (let A = Math.max(app, today) + 1; A < hi; A++) if (calc(A).total >= NEED_DAYS) { eligibleOn = A; break; }
  return { ...cur, app: diso(app), start: diso(cur.start), eligibleOn: eligibleOn == null ? null : diso(eligibleOn), ok: cur.total >= NEED_DAYS };
}
const filesIn = (slot) => S.data.files.filter((f) => f.slot === slot).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.addedAt).localeCompare(String(b.addedAt)));
function docsStatus() {
  const pass = filesIn("passport");
  return {
    passportPdf: filesIn("passportPdf").length > 0 || pass.some((f) => f.type === "application/pdf"),
    pages: pass.filter((f) => f.type.startsWith("image/")).length,
    prCard: filesIn("prCard").length > 0,
    language: filesIn("language").length > 0,
    id2: filesIn("id2").length > 0,
    confirmation: filesIn("confirmation").length > 0,
  };
}
const docsMissingN = (ds) => [!ds.prCard, !ds.passportPdf, !ds.language, !ds.id2].filter(Boolean).length;
function eligibleDone() {
  const a = S.data.answers, p = presence();
  return !!p?.ok && (a.taxYears || []).length >= 3 && !!a.langProof && a.langProof !== "none";
}
function steps() {
  const ds = docsStatus();
  const ck = S.data.checklist;
  const firstOpen = (ids) => ids.find((id) => !groupDone(id));
  const hist = ["trips", "addr", "work"], other = GROUPS.filter((g) => g.id !== "ids").map((g) => g.id);
  const list = [
    { key: "eligible", done: eligibleDone(), tab: "gaps", group: firstOpen(["status", "trips", "taxes", "lang"]) || "status" },
    { key: "history", done: hist.every(groupDone), tab: "gaps", group: firstOpen(hist) || "trips" },
    { key: "answers", done: other.every(groupDone), tab: "gaps", group: firstOpen(other) || "police" },
    { key: "ids", done: groupDone("ids"), tab: "gaps", group: "ids" },
    { key: "docs", done: docsMissingN(ds) === 0, tab: "docs" },
    { key: "online", done: !!(ck.account && ck.calc && ck.fill && ck.upload), tab: "submit" },
    { key: "submit", done: !!(ck.sign && ck.paid), tab: "submit" },
    { key: "after", done: !!ck.oath, tab: "submit" },
  ];
  const cur = list.findIndex((s) => !s.done);
  list.forEach((s, i) => (s.state = s.done ? "done" : i === cur ? "now" : "todo"));
  return list;
}
function nextActions() {
  const out = [];
  const ds = docsStatus();
  const ck = S.data.checklist;
  if (!groupDone("status")) out.push({ icon: "id", t: t("nxStatus"), d: t("nxStatusD"), tab: "gaps", group: "status" });
  if (!groupDone("trips")) out.push({ icon: "send", t: t("nxTrips"), d: t("nxTripsD"), tab: "gaps", group: "trips" });
  const n = openQuestions(false, ["status", "trips"]);
  if (n) out.push({ icon: "pen", t: t("nxAnswers", { n: faDigits(n) }), d: t("nxAnswersD"), tab: "gaps", group: GROUPS.find((g) => !["ids", "status", "trips"].includes(g.id) && !groupStatus(g).complete)?.id });
  if (!groupDone("ids")) out.push({ icon: "id", t: t("nxIds"), d: t("nxIdsD"), tab: "gaps", group: "ids" });
  if (!ds.prCard) out.push({ icon: "id", t: t("nxPrCard"), d: t("nxPrCardD"), tab: "docs" });
  if (!ds.passportPdf) out.push({ icon: "passport", t: t("nxPassport"), d: t("nxPassportD"), tab: "docs" });
  if (!ds.language) out.push({ icon: "globe", t: t("nxLang"), d: t("nxLangD"), tab: "docs" });
  if (!ds.id2) out.push({ icon: "id", t: t("nxId2"), d: t("nxId2D"), tab: "docs" });
  if (!(ck.account && ck.calc && ck.fill && ck.upload)) out.push({ icon: "send", t: t("nxOnline"), d: t("nxOnlineD"), tab: "submit" });
  else if (!(ck.sign && ck.paid)) out.push({ icon: "pen", t: t("nxSubmit"), d: t("nxSubmitD"), tab: "submit" });
  else if (!ck.oath) out.push({ icon: "calendar", t: t("nxAfter"), d: t("nxAfterD"), tab: "submit" });
  return out;
}

/* ====================================================================== */
/* logo + progress                                                         */
/* ====================================================================== */
function logoHTML(cls = "") {
  return `<span class="logo ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 11V8.5a4 4 0 018 0V11"/><rect x="5.5" y="11" width="13" height="9" rx="2.2" fill="currentColor" stroke="none"/></svg></span>`;
}
function segbarHTML(list, intro) {
  return `<div class="segbar ${intro ? "intro" : ""}" role="list">${list.map((s, i) => `<button role="listitem" class="${s.state}" data-action="step" data-step="${i}"
    style="animation-delay:${i * 60}ms" aria-label="${esc(`${i + 1}. ${t("s_" + s.key)}`)}" title="${esc(`${i + 1}. ${t("s_" + s.key)}`)}"></button>`).join("")}</div>`;
}

/* ====================================================================== */
/* gate screens                                                            */
/* ====================================================================== */
function langSeg() {
  return `<div class="seg" role="group" aria-label="Language">
    <button data-action="lang" data-lang="en" aria-pressed="${LANG === "en"}">EN</button>
    <button data-action="lang" data-lang="fa" aria-pressed="${LANG === "fa"}" lang="fa">فا</button></div>`;
}
function applyLang() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === "fa" ? "rtl" : "ltr";
}
function applyTheme() {
  const th = store.get("nasrin.theme");
  if (th === "dark" || th === "light") document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
}
const app = () => $("#app");

function renderLock(msg = "") {
  document.title = t("brand");
  app().innerHTML = `
  <div class="gate">
    <form class="card gate-card" id="lock-form" autocomplete="on">
      <div class="gate-top"><span class="eyebrow">${esc(t("vaultSub"))}</span>${langSeg()}</div>
      ${logoHTML()}
      <h1 class="display">${esc(t("brand"))}</h1>
      <p class="sub">${esc(t("unlockSub"))}</p>
      ${IS_LOCAL ? `<p class="okmsg small">${esc(t("local"))}</p>` : ""}
      <div class="stack">
        <div class="field"><label for="u">${esc(t("username"))}</label>
          <input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
        <div class="field"><label for="p">${esc(t("password"))}</label>
          <div class="pw-wrap"><input class="input mono" id="p" name="password" type="password" autocomplete="current-password" spellcheck="false" required>
          <button type="button" class="btn ghost sm" data-action="pw-toggle" aria-controls="p">${esc(t("show"))}</button></div></div>
        ${msg ? `<div class="err" role="alert">${esc(msg)}</div>` : ""}
        <button class="btn primary" id="unlock-btn" type="submit">${ic("lock")}${esc(t("unlock"))}</button>
      </div>
      <div class="gate-foot">${ic("shield")}<span>${esc(t("gateFoot"))}</span></div>
    </form>
  </div>`;
  $("#lock-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#unlock-btn");
    btn.disabled = true;
    btn.innerHTML = esc(t("unlocking"));
    try {
      await doUnlock($("#u").value, $("#p").value);
    } catch (err) {
      console.warn(err);
      renderLock(err.message === "wrong-credentials" ? t("wrong") : String(err.message || err));
    }
  });
  setTimeout(() => $("#u")?.focus(), 50);
}

function renderSetup(step = 1, msg = "") {
  const siteRepo = guessSiteRepo();
  const body = step === 1 ? `
    <h1 class="display" style="font-size:32px;text-align:start">${esc(t("setupTitle"))}</h1>
    <p class="muted">${esc(t("setupLede"))}</p>
    <form class="stack" id="setup-form">
      <div class="field"><label for="sr">${esc(t("setupRepo"))}</label>
        <input class="input mono" id="sr" required value="${esc(S.secretRepo || "")}" placeholder="owner/nasrinjalili-vault" autocomplete="off" autocapitalize="none" spellcheck="false">
        <span class="hint">${esc(t("setupRepoHint"))}</span></div>
      <div class="field"><label for="ss">${esc(t("setupSite"))}</label>
        <input class="input mono" id="ss" required value="${esc(siteRepo)}" placeholder="owner/nasrinjalili" autocomplete="off" autocapitalize="none" spellcheck="false">
        <span class="hint">${esc(t("setupSiteHint"))}</span></div>
      <div class="field"><label for="tk">${esc(t("setupToken"))}</label>
        <input class="input mono masked" id="tk" type="text" name="gh-token" required autocomplete="off" data-lpignore="true" data-1p-ignore="true" spellcheck="false" autocapitalize="none" placeholder="github_pat_…">
        <span class="hint">${esc(t("setupTokenHint"))} <a href="${TOKEN_URL}" target="_blank" rel="noopener">${esc(t("makeToken"))}</a></span></div>
      ${msg ? `<div class="err" role="alert">${esc(msg)}</div>` : ""}
      <button class="btn primary" id="setup-go">${esc(t("setupGo"))}</button>
    </form>` : `
    <h1 class="display" style="font-size:32px;text-align:start">${esc(t("seedTitle"))}</h1>
    <p class="muted">${esc(t("seedLede"))}</p>
    ${S.secretRepo ? `<p class="okmsg">${esc(t("connected", { repo: S.secretRepo }))}</p>` : ""}
    <label class="drop" id="seed-drop" for="seed-file">${ic("upload", 'style="width:28px;height:28px"')}<br><b>${esc(t("seedChoose"))}</b></label>
    <input type="file" id="seed-file" accept=".nasrin,.lapis" hidden>
    <div class="progress" id="seed-prog" hidden><i></i></div>
    <p id="seed-msg" class="small muted" aria-live="polite"></p>
    ${msg ? `<div class="err" role="alert">${esc(msg)}</div>` : ""}`;
  app().innerHTML = `<div class="gate"><div class="card gate-card wide">
    <div class="gate-top"><span class="eyebrow">${esc(t("brand"))}</span>${langSeg()}</div>
    <div class="steps-mini"><span class="on"></span><span class="${step === 2 ? "on" : ""}"></span></div>
    ${body}
    <div class="gate-foot">${ic("shield")}<span>${esc(t("gateFoot"))}</span></div></div></div>`;
  if (step === 1) {
    $("#setup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const cleanRepo = (v) => v.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
      const repo = cleanRepo($("#sr").value), site = cleanRepo($("#ss").value);
      const raw = $("#tk").value.replace(/\s+/g, "");
      // Pull the token out of whatever was pasted (an autofilled password in front of it, quotes, etc).
      const token = (raw.match(/github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/) || [raw])[0];
      const repoOk = (v) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v);
      if (!repoOk(repo) || !repoOk(site)) return renderSetup(1, t("setupRepoBad"));
      if (!/^(github_pat_|gh[pousr]_)/.test(token)) return renderSetup(1, t("setupNotToken", { n: token.length }));
      $("#setup-go").disabled = true;
      $("#setup-go").textContent = t("setupChecking");
      try {
        if (!(await connectStorage({ repo, site, token }))) renderSetup(2);
      } catch (err) {
        renderSetup(1, err.message);
      }
    });
  } else {
    const input = $("#seed-file");
    input.addEventListener("change", () => input.files[0] && importSeedFile(input.files[0]));
    const drop = $("#seed-drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) importSeedFile(f); });
    // Local test server only: ?seed=/test-seed.nasrin loads the starter file without a file picker.
    const seedUrl = IS_LOCAL && new URLSearchParams(location.search).get("seed");
    if (seedUrl && seedUrl.startsWith("/")) {
      fetch(seedUrl, { cache: "no-store" }).then((r) => r.arrayBuffer()).then((b) => importSeedFile(new File([b], "seed.nasrin")));
    }
  }
}

async function connectStorage({ repo, site, token }) {
  const gh = (path, opts = {}) => fetch(`${API}${path}`, { cache: "no-store", ...opts, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) } });
  const r = await gh(`/repos/${repo}`);
  if (r.status === 401) {
    let why = "";
    try { why = (await r.json()).message || ""; } catch { /* no body */ }
    throw new Error(t("setupBadToken") + ` (${token.length} ${LANG === "fa" ? "نویسه" : "characters"}${why ? " · GitHub: " + why : ""})`);
  }
  if (!r.ok) throw new Error(t("setupNoAccess", { repo }));
  const info = await r.json();
  if (!info.private) throw new Error(t("setupNotPrivate"));
  const secret = { token, repo, branch: info.default_branch || "main" };
  const sealed = toB64(await sealJSON(S.key, secret));
  // write the sealed secret into the public site's vault.json
  const cur = await gh(`/repos/${site}/contents/vault.json`);
  if (!cur.ok) throw new Error(t("setupNoAccess", { repo: site }));
  const curJson = await cur.json();
  const next = { ...S.vault, secret: sealed };
  const put = await gh(`/repos/${site}/contents/vault.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "vault update", content: btoa(JSON.stringify(next, null, 2) + "\n"), sha: curJson.sha }),
  });
  if (!put.ok) throw new Error(t("setupNoAccess", { repo: site }));
  S.vault = next;
  store.set("nasrin.secret", sealed);
  S.store = new GitHubStore(secret);
  S.secretRepo = repo;
  const existing = await S.store.readCase();
  if (existing) {
    S.data = await openJSON(S.key, existing.bytes);
    S.sha = existing.sha;
    normalize();
    startApp();
    return true;
  }
  return false;
}

async function importSeedFile(file) {
  const msg = $("#seed-msg"), prog = $("#seed-prog");
  try {
    const bundle = await openJSON(S.key, new Uint8Array(await file.arrayBuffer()));
    if (!/^(nasrin|lapis)-bundle$/.test(bundle.kind) || !bundle.case) throw new Error(t("importBad"));
    prog.hidden = false;
    const total = bundle.files.length;
    const meta = Object.fromEntries(bundle.case.files.map((f) => [f.id, f]));
    let n = 0;
    for (const f of bundle.files) {
      msg.textContent = t("seedLoading", { n: n + 1, total });
      const sha = await S.store.writeFile(f.id, await seal(S.key, fromB64(f.b64)));
      if (meta[f.id]) meta[f.id].sha = sha;
      n++;
      prog.firstElementChild.style.width = (100 * n) / (total + 1) + "%";
    }
    const existing = await S.store.readCase();
    S.data = bundle.case;
    normalize();
    S.data.log.unshift({ at: nowISO(), by: "you", text: "Vault set up from the starter file." });
    S.sha = await S.store.writeCase(await sealJSON(S.key, S.data), existing?.sha || null);
    prog.firstElementChild.style.width = "100%";
    msg.textContent = t("seedDone");
    await sleep(500);
    startApp();
  } catch (err) {
    console.warn(err);
    msg.textContent = "";
    prog.hidden = true;
    const m = $("#seed-msg");
    m.innerHTML = `<span class="err" role="alert">${esc(/operation|decrypt|vault-file/i.test(String(err.message)) ? t("importBad") : err.message)}</span>`;
  }
}

/* ====================================================================== */
/* main app                                                                */
/* ====================================================================== */
function startApp() {
  const gn = S.data.profile?.givenName || "";
  document.title = gn ? `${gn.charAt(0).toUpperCase()}${gn.slice(1).toLowerCase()} · Citizenship` : t("brand");
  app().innerHTML = `
    ${IS_LOCAL ? `<div class="test-banner">${esc(t("local"))}</div>` : ""}
    <header class="topbar"><div class="topbar-in" id="topbar"></div></header>
    <div class="shell">
      <aside class="card rail" id="seal"></aside>
      <main>
        <nav class="tabs" id="tabs" role="tablist"></nav>
        <section id="panel"></section>
      </main>
    </div>
    <div id="modal-root"></div>`;
  renderMain();
  S.intro = false;
  armIdle();
}
function renderMain() {
  renderTop();
  renderSeal();
  renderTabs();
  renderPanel();
}
function refreshChrome() {
  renderTop();
  renderSeal();
  renderTabs();
  const gl = $("#gap-list");
  if (gl) gl.innerHTML = gapListHTML();
  document.querySelectorAll("[data-cov]").forEach((el) => (el.innerHTML = coverageHTML(el.dataset.cov)));
  document.querySelectorAll(".pp-live").forEach((el) => (el.innerHTML = presenceHTML()));
}
function renderTop() {
  const el = $("#topbar");
  if (!el) return;
  const st = IS_LOCAL && S.saveState === "saved" ? "local" : S.saveState;
  const cls = { saved: "ok", local: "warn", saving: "plain", pending: "plain", offline: "bad" }[st];
  const p = S.data.profile;
  const th = document.documentElement.dataset.theme;
  el.innerHTML = `
    <a class="brand" href="#" data-action="tab" data-tab="overview" aria-label="${esc(t("brand"))}">${logoHTML()}<span>${esc(t("brand"))}</span></a>
    <div class="case-name"><b>${esc(p.givenName.charAt(0) + p.givenName.slice(1).toLowerCase())} ${esc(p.familyName.charAt(0) + p.familyName.slice(1).toLowerCase())}</b> · ${esc(t("caseTitle"))}</div>
    <div class="spacer"></div>
    <span class="chip ${cls} save-chip" title="${esc(t(st))}"><span class="txt">${esc(t(st))}</span></span>
    ${langSeg()}
    <button class="iconbtn" data-action="theme" aria-label="${esc(t("theme"))}">${ic(th === "dark" ? "sun" : "moon")}</button>
    <button class="iconbtn" data-action="lock" aria-label="${esc(t("lock"))}" title="${esc(t("lock"))}">${ic("lock")}</button>`;
}
function presenceRailHTML() {
  const p = presence();
  if (!p) return `<div class="eyebrow">${esc(t("presence"))}</div><p class="small muted" style="margin:10px 0 0">${esc(t("noPrDate"))}</p>`;
  const pct = Math.min(100, (100 * p.total) / NEED_DAYS);
  return `<div class="eyebrow">${esc(t("presence"))}</div>
    <div class="cd-num"><b>${faDigits(p.total.toLocaleString("en-CA"))}</b><span>${esc(t("ofDays", { need: faDigits("1,095") }))}</span></div>
    <div class="pp-bar ${p.ok ? "ok" : ""}"><i style="width:${pct}%"></i></div>
    <div class="cd-when">${p.ok ? `<b>${esc(t("eligibleNow"))}</b><br><span class="small muted">${t("eligibleNowD", { date: fmtDate(p.app) })}</span>`
      : p.eligibleOn ? `${t("eligibleOn", { date: `<b>${fmtDate(p.eligibleOn)}</b>` })}<br><span class="small muted">${esc(t("eligibleOnD"))}</span>` : ""}</div>`;
}
function renderSeal() {
  const el = $("#seal");
  if (!el) return;
  const list = steps();
  const doneN = list.filter((s) => s.done).length;
  el.innerHTML = `
    <div class="cd">
      ${presenceRailHTML()}
      <div class="form-links">
        <a class="btn sm primary" href="${CIT_PORTAL}" target="_blank" rel="noopener">${ic("send")}${esc(t("openPortal"))}</a>
        <a class="btn sm" href="${ELIG_PAGE}" target="_blank" rel="noopener">${ic("shield")}${esc(t("eligPage"))}</a>
      </div>
    </div>
    <div class="rail-sep"></div>
    <div class="prog">
      <div class="prog-head"><span class="eyebrow">${esc(t("progress"))}</span><span class="mono">${faDigits(doneN)} / ${faDigits(list.length)}</span></div>
      ${segbarHTML(list, S.intro)}
      <ol class="legend">${list.map((s, i) => `<li class="${s.state}"><button data-action="step" data-step="${i}">
        <span class="dot">${s.done ? ic("check") : faDigits(i + 1)}</span><span>${esc(t("s_" + s.key))}</span></button></li>`).join("")}</ol>
    </div>`;
}
function renderTabs() {
  const el = $("#tabs");
  if (!el) return;
  const n = openQuestions(true);
  const docsMissing = docsMissingN(docsStatus());
  const unread = S.data.notes.filter((x) => x.by === "claude" && !x.seenByYou).length;
  const ck = S.data.checklist;
  const subLeft = ["account", "calc", "fill", "upload", "sign", "paid", "confirm"].filter((k) => !ck[k]).length;
  const tabs = [
    ["overview", t("tabOverview"), ""],
    ["gaps", t("tabGaps"), n ? `<span class="badge">${faDigits(n)}</span>` : `<span class="badge ok">✓</span>`],
    ["docs", t("tabDocs"), docsMissing ? `<span class="badge">${faDigits(docsMissing)}</span>` : `<span class="badge ok">✓</span>`],
    ["notes", t("tabNotes"), unread ? `<span class="badge">${faDigits(unread)}</span>` : ""],
    ["submit", t("tabSubmit"), subLeft ? `<span class="badge">${faDigits(subLeft)}</span>` : `<span class="badge ok">✓</span>`],
  ];
  el.innerHTML = tabs.map(([id, label, b]) => `<button role="tab" id="tab-${id}" aria-selected="${S.tab === id}" data-action="tab" data-tab="${id}">${esc(label)}${b}</button>`).join("");
}
function renderPanel() {
  const el = $("#panel");
  if (!el) return;
  const active = document.activeElement;
  const id = active && el.contains(active) ? active.id : null;
  const sel = id && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  const html = { overview: overviewHTML, gaps: gapsHTML, docs: docsHTML, notes: notesHTML, submit: submitHTML }[S.tab] || overviewHTML;
  const sameTab = el.dataset.tab === S.tab;
  const y = window.scrollY;
  el.style.minHeight = sameTab ? el.offsetHeight + "px" : "";
  el.innerHTML = `<div class="panel ${sameTab ? "still" : ""}" role="tabpanel" aria-labelledby="tab-${S.tab}">${html()}</div>`;
  el.dataset.tab = S.tab;
  if (sameTab) { window.scrollTo(0, y); requestAnimationFrame(() => { el.style.minHeight = ""; }); }
  if (id) {
    const n = document.getElementById(id);
    if (n) { n.focus({ preventScroll: true }); if (sel) try { n.setSelectionRange(...sel); } catch { /* not text */ } }
  }
  hydrateThumbs();
  if (S.tab === "notes") {
    const unread = S.data.notes.filter((x) => x.by === "claude" && !x.seenByYou);
    if (unread.length) setTimeout(() => mutate((d) => d.notes.forEach((x) => { if (x.by === "claude") x.seenByYou = true; }), { render: false }), 1500);
  }
}

/* ---------------- overview ---------------- */
function overviewHTML() {
  const d = S.data, p = d.profile, a = d.answers;
  const list = steps();
  const doneN = list.filter((s) => s.done).length;
  const acts = nextActions();
  const pp = presence();
  const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");
  const taxes = (a.taxYears || []).length;
  const langOpt = groupById("lang").fields[0].options.find(([v]) => v === a.langProof);
  const dash = `<span class="muted">${esc(t("notYet"))}</span>`;
  return `
  <h2 class="display">${esc(t("ovTitle"))}</h2>
  <p class="status-line">${t("ovStatus", { done: `<b>${faDigits(doneN)}</b>` })}
    ${acts[0] ? ` ${esc(t("ovNextIs"))} <b>${esc(acts[0].t)}</b>.` : ""}</p>
  <div class="card profile">
    <div class="head"><div><div class="eyebrow">${esc(t("caseTitle"))}</div>
      <div class="name">${esc(title(p.givenName))} ${esc(title(p.familyName))}</div></div>
      <span class="chip ok">${esc(p.status || "")}</span></div>
    <dl>
      <div><dt>${LANG === "fa" ? "تاریخ تولد" : "Date of birth"}</dt><dd>${fmtDate(p.dob)}</dd></div>
      <div><dt>${LANG === "fa" ? "محل تولد" : "Born in"}</dt><dd>${esc(a.birthPlace || p.birthPlace || "") || dash}</dd></div>
      <div><dt>${LANG === "fa" ? "تابعیت" : "Citizenship"}</dt><dd>${esc(p.citizenship || "")}</dd></div>
      <div><dt>${LANG === "fa" ? "وضعیت تأهل" : "Marital status"}</dt><dd>${esc(a.marital || p.maritalStatus || "")}</dd></div>
    </dl>
  </div>
  ${acts.length ? `<h3 class="section-title display">${esc(t("nextTitle"))}</h3>
  <div class="next-list">${acts.slice(0, 4).map((x, i) => `
    <button class="next ${i === 0 ? "first" : ""}" data-action="goto" data-tab="${x.tab}" ${x.group ? `data-group="${x.group}"` : ""}>
      <span class="n">${ic(x.icon)}</span><span><div class="t">${esc(x.t)}</div><div class="d">${esc(x.d)}</div></span><span class="go">${ic("arrow", LANG === "fa" ? 'style="transform:scaleX(-1)"' : "")}</span>
    </button>`).join("")}</div>` : `<p class="okmsg">${esc(t("allDone"))}</p>`}
  <h3 class="section-title display">${esc(t("factsTitle"))}</h3>
  <div class="grid3" style="margin-bottom:26px">
    <div class="fact ${pp && !pp.ok ? "flag" : ""}"><div class="k">${esc(t("presence"))}</div>
      <div class="v mono">${pp ? `${faDigits(pp.total.toLocaleString("en-CA"))} / ${faDigits("1,095")}` : dash}</div>
      <div class="s">${pp ? (pp.ok ? esc(t("eligibleNow")) : pp.eligibleOn ? t("eligibleOn", { date: fmtDate(pp.eligibleOn) }) : "") : esc(t("noPrDate"))}</div></div>
    <div class="fact"><div class="k">${esc(t("fStatus"))}</div><div class="v">${esc(p.status || "")}</div>
      <div class="s">${a.prDate ? t("prSince", { date: fmtDate(a.prDate) }) : esc(t("notYet"))}</div></div>
    <div class="fact ${taxes && taxes < 3 ? "flag" : ""}"><div class="k">${esc(t("fTaxes"))}</div><div class="v">${taxes ? esc(t("taxN", { n: faDigits(taxes) })) : dash}</div>
      <div class="s">${esc(t("taxNeed"))}</div></div>
    <div class="fact ${a.langProof === "none" ? "flag" : ""}"><div class="k">${esc(t("fLang"))}</div><div class="v">${langOpt ? esc(L(langOpt[1])) : dash}</div>
      <div class="s" dir="auto">${esc(String(a.langDetail || "").slice(0, 90))}</div></div>
    <div class="fact"><div class="k">${esc(t("fFee"))}</div><div class="v mono">$${d.application?.fees?.total ?? 653} CAD</div><div class="s">${esc(t("feeBody"))}</div></div>
    <div class="fact"><div class="k">${esc(t("fContact"))}</div><div class="v mono" style="font-size:15px">${esc(a.phone || p.phone || "") || dash}</div><div class="s" style="overflow-wrap:anywhere">${esc(a.email || p.email || "")}</div></div>
    <div class="fact" style="grid-column:1/-1"><div class="k">${esc(t("reqTitle"))}</div><div class="v">${esc(t("caseTitle"))}</div><div class="s">${esc(t("reqBody"))}</div></div>
  </div>
  <h3 class="section-title display">${esc(t("logTitle"))}</h3>
  <ul class="log">${d.log.slice(0, 8).map((l) => `<li><span class="at">${esc(fmtStamp(l.at))}</span><span>${l.by === "claude" ? "<b>Claude</b> · " : ""}${esc(l.text)}</span></li>`).join("")}</ul>`;
}

/* ---------------- gaps ---------------- */
function gapListHTML() {
  return GROUPS.map((g) => {
    const s = groupStatus(g);
    const cls = s.complete ? "done" : s.done ? "part" : "";
    const pct = s.total ? Math.round((360 * s.done) / s.total) : 0;
    return `<button data-action="group" data-group="${g.id}" aria-current="${S.group === g.id}">
      <span class="st ${cls}" style="--p:${pct}deg">${s.complete ? ic("check") : ""}</span>
      <span>${esc(L(g.title))}</span></button>`;
  }).join("");
}
function gapsHTML() {
  const g = GROUPS.find((x) => x.id === S.group) || GROUPS[0];
  const idx = GROUPS.indexOf(g);
  const all = GROUPS.every((x) => groupStatus(x).complete);
  return `
  <h2 class="display">${esc(t("gapsTitle"))}</h2>
  <p class="lede">${esc(t("gapsLede"))}</p>
  <div class="gaps">
    <nav class="gap-list" id="gap-list" aria-label="${esc(t("gapsTitle"))}">${gapListHTML()}</nav>
    <div class="card qcard">
      <div class="eyebrow">${faDigits(idx + 1)} / ${faDigits(GROUPS.length)}</div>
      <h3 class="display">${esc(L(g.title))}</h3>
      <p class="intro">${esc(L(g.intro))}</p>
      <div class="qfields">${g.fields.filter(visible).map((f) => fieldHTML(g, f)).join("")}</div>
      <div class="q-foot">
        ${idx > 0 ? `<button class="btn" data-action="group" data-group="${GROUPS[idx - 1].id}">${esc(t("prevGroup"))}</button>` : "<span></span>"}
        ${idx < GROUPS.length - 1 ? `<button class="btn primary" data-action="group" data-group="${GROUPS[idx + 1].id}">${esc(t("nextGroup"))}${ic("arrow", LANG === "fa" ? 'style="transform:scaleX(-1)"' : "")}</button>`
          : all ? `<span class="chip ok">${esc(t("allAnswered"))}</span>` : ""}
      </div>
    </div>
  </div>`;
}
function unsureHTML(g, f) {
  if (f.optional || ROWLESS.has(f.type)) return "";
  const a = g.store === "ids" ? S.data.ids : S.data.answers;
  return `<label class="unsure-tog"><input type="checkbox" id="u-${f.id}" data-unsure="${f.id}" data-store="${g.store || ""}" ${a[f.id + "Unsure"] ? "checked" : ""}>${esc(t("notSure"))}</label>`;
}
function hintHTML(f) {
  return f.hint ? `<div class="hint">${ic("alert")}<span>${esc(L(f.hint))}</span></div>` : "";
}
function presenceHTML() {
  const p = presence();
  if (!p) return `<div class="hint">${ic("alert")}<span>${esc(t("noPrDate"))}</span></div>`;
  const pct = Math.min(100, (100 * p.total) / NEED_DAYS);
  const n = (x) => faDigits(Math.floor(x).toLocaleString("en-CA"));
  return `<div class="pp-card">
    <div class="pp-top"><b class="mono">${n(p.total)}</b><span class="muted">${esc(t("ofDays", { need: faDigits("1,095") }))}</span><span class="spacer"></span>
      <span class="chip ${p.ok ? "ok" : "warn"}">${p.ok ? esc(t("eligibleNow")) : p.eligibleOn ? t("eligibleOn", { date: fmtDate(p.eligibleOn) }) : ""}</span></div>
    <div class="pp-bar ${p.ok ? "ok" : ""}"><i style="width:${pct}%"></i></div>
    <dl class="pp-dl">
      <div><dt>${esc(t("prDays"))}</dt><dd class="mono">${n(p.full)}</dd></div>
      <div><dt>${esc(t("preDays"))}</dt><dd class="mono">${n(p.credit)}</dd></div>
      <div><dt>${esc(t("awayDays"))}</dt><dd class="mono">${n(p.away)}</dd></div>
      <div><dt>${esc(t("windowLbl"))}</dt><dd>${fmtDate(p.start)} – ${fmtDate(p.app)}</dd></div>
    </dl>
    <p class="small muted" style="margin:8px 0 0">${esc(t("presenceNote"))}</p></div>`;
}
function fieldHTML(g, f) {
  const v = getVal(g, f) ?? "";
  const st = g.store || "";
  const lbl = `<label class="qlabel" for="f-${f.id}">${esc(L(f.label))}</label>`;
  switch (f.type) {
    case "presence":
      return `<div class="q pp-live">${presenceHTML()}</div>`;
    case "date": {
      const jal = S.jalOpen === f.id;
      return `<div class="q">${lbl}${hintHTML(f)}
        <div class="date-row">
          <input class="input" type="date" id="f-${f.id}" data-ans="${f.id}" data-store="${st}" value="${esc(v)}" min="1950-01-01" ${f.future ? "" : `max="${todayISO()}"`}>
          <button class="btn sm" data-action="jal-open" data-id="${f.id}" aria-expanded="${jal}">${ic("calendar")}<span lang="fa">${esc(t("jalaliEnter"))}</span></button>
          ${unsureHTML(g, f)}
        </div>
        ${v ? `<div class="jal" id="jal-${f.id}">${esc(jalaliLabel(v))}</div>` : `<div class="jal" id="jal-${f.id}"></div>`}
        ${jal ? `<div class="jal-entry" role="group" aria-label="${esc(t("jalaliEnter"))}">
          <input class="input mono" id="jy-${f.id}" inputmode="numeric" placeholder="${t("jalaliYear")} ۱۴۰۱" aria-label="${t("jalaliYear")}">
          <input class="input mono" id="jm-${f.id}" inputmode="numeric" placeholder="${t("jalaliMonth")}" aria-label="${t("jalaliMonth")}">
          <input class="input mono" id="jd-${f.id}" inputmode="numeric" placeholder="${t("jalaliDay")}" aria-label="${t("jalaliDay")}">
          <button class="btn sm accent" data-action="jal-use" data-id="${f.id}" data-store="${st}">${esc(t("jalaliUse"))}</button>
          <span class="small" id="jal-err-${f.id}"></span></div>` : ""}
      </div>`;
    }
    case "month":
      return `<div class="q">${lbl}${hintHTML(f)}<div class="date-row">
        <input class="input" type="month" id="f-${f.id}" data-ans="${f.id}" data-store="${st}" value="${esc(v)}" placeholder="YYYY-MM" max="${todayISO().slice(0, 7)}">${unsureHTML(g, f)}</div></div>`;
    case "text":
      return `<div class="q">${lbl}${hintHTML(f)}
        <input class="input" id="f-${f.id}" data-ans="${f.id}" data-store="${st}" value="${esc(v)}" autocomplete="off">
        <div>${unsureHTML(g, f)}</div></div>`;
    case "textarea":
      return `<div class="q">${lbl}${hintHTML(f)}<textarea class="input" id="f-${f.id}" data-ans="${f.id}" data-store="${st}">${esc(v)}</textarea></div>`;
    case "id":
      return `<div class="q">${lbl}${hintHTML(f)}<div class="id-row">
        <input class="input mono" id="f-${f.id}" data-ans="${f.id}" data-store="ids" value="${esc(v)}" autocomplete="off" spellcheck="false" autocapitalize="characters">
        <button class="btn sm" data-action="copy" data-copy="${f.id}">${ic("copy")}${esc(t("copy"))}</button></div><div>${unsureHTML(g, f)}</div></div>`;
    case "years": {
      const a = S.data.answers;
      const sel = Array.isArray(a[f.id]) ? a[f.id] : [];
      const unsure = !!a[f.id + "Unsure"];
      return `<div class="q"><div class="qlabel" id="f-${f.id}">${esc(L(f.label))}</div>${hintHTML(f)}
        <div class="choices" role="group" aria-labelledby="f-${f.id}">
          ${taxYears().map((y) => `<button data-action="year" data-id="${f.id}" data-val="${y}" aria-pressed="${!unsure && sel.includes(y)}">${faDigits(y)}</button>`).join("")}
          <button class="unsure" data-action="pick-unsure" data-id="${f.id}" data-store="" aria-pressed="${unsure}">${esc(t("notSure"))}</button>
        </div>
        <div class="small ${sel.length && sel.length < 3 ? "" : "muted"}" style="margin-top:6px;${sel.length && sel.length < 3 ? "color:var(--danger)" : ""}">${sel.length ? esc(t("taxN", { n: faDigits(sel.length) })) + " · " : ""}${esc(t("taxNeed"))}</div></div>`;
    }
    case "choice":
    case YN: {
      const opts = f.type === YN ? [["yes", { en: t("yes"), fa: "بله" }], ["no", { en: t("no"), fa: "خیر" }]]
        : typeof f.options === "function" ? f.options(S.data) : f.options;
      const a = g.store === "ids" ? S.data.ids : S.data.answers;
      const unsure = !!a[f.id + "Unsure"];
      return `<div class="q"><div class="qlabel" id="f-${f.id}">${esc(L(f.label))}</div>${hintHTML(f)}
        <div class="choices" role="group" aria-labelledby="f-${f.id}">
          ${opts.map(([val, lb]) => `<button class="${val === "yes" ? "yes" : ""}" data-action="pick" data-id="${f.id}" data-val="${esc(val)}" data-store="${st}" aria-pressed="${!unsure && v === val}">${esc(L(lb))}</button>`).join("")}
          ${f.optional ? "" : `<button class="unsure" data-action="pick-unsure" data-id="${f.id}" data-store="${st}" aria-pressed="${unsure}">${esc(t("notSure"))}</button>`}
        </div>
        ${f.details && v === "yes" ? `<textarea class="input" id="f-${f.id}Detail" data-ans="${f.id}Detail" data-store="${st}" placeholder="${esc(t("details"))}">${esc(a[f.id + "Detail"] || "")}</textarea>` : ""}
      </div>`;
    }
    case "timeline":
      return timelineHTML(f.id);
    case "list":
      return `<div class="q"><div class="qlabel">${esc(L(f.label))}</div>${daysHTML(f.id)}</div>`;
    default:
      return "";
  }
}
// Each period keeps its colour (r.c) so removing one never repaints the others.
const ROW_COLORS = 7;
function rowColors(rows) {
  const used = new Set(rows.map((r) => r.c).filter(Number.isInteger));
  for (const r of rows) {
    if (Number.isInteger(r.c)) continue;
    let c = 0;
    while (used.has(c) && c < ROW_COLORS) c++;
    r.c = c % ROW_COLORS;
    used.add(r.c);
  }
  return rows.map((r) => r.c);
}
// Row indexes, newest start date first; rows still missing a start date stay last, next to Add.
function workOrder(rows) {
  const end = (r) => (r.present ? "9999-99" : r.to || "");
  return rows.map((r, k) => k).sort((x, y) => String(rows[y].from || "").localeCompare(String(rows[x].from || "")) || end(rows[y]).localeCompare(end(rows[x])) || x - y);
}
const rowLabel = (list, r, k) => r[LISTS[list].label] || `${t(LISTS[list].label)} ${faDigits(k + 1)}`;
function coverageHTML(list) {
  const w = timelineStatus(list);
  const n = w.covered.length;
  const rows = S.data.answers[list] || [];
  const cols = rowColors(rows);
  const span = (a, b) => `left:${(100 * a) / n}%;width:${(100 * (b - a + 1)) / n}%`;
  let gaps = "", i = 0;
  while (i < n) {
    if (!w.covered[i]) { let j = i; while (j + 1 < n && !w.covered[j + 1]) j++; gaps += `<b style="${span(i, j)}"></b>`; i = j + 1; } else i++;
  }
  const order = workOrder(rows);
  const lanes = order.map((k) => {
    const r = rows[k];
    const a = monthIndex(r.from), b = r.present ? w.end : monthIndex(r.to);
    const lo = a == null ? null : Math.max(a, w.start) - w.start, hi = b == null ? null : Math.min(b, w.end) - w.start;
    const tip = `${rowLabel(list, r, k)} · ${r.from || "?"} – ${r.present ? t("present") : r.to || "?"}`;
    return `<div class="lane wc${cols[k]}">${lo != null && hi != null && hi >= lo ? `<button class="seg" style="${span(lo, hi)}" data-action="row-sheet" data-list="${list}" data-row="${k}" title="${esc(tip)}" aria-label="${esc(tip)}"></button>` : ""}</div>`;
  }).join("") || `<div class="lane"></div>`;
  const legend = order.map((k) => `<li class="wc${cols[k]}"><button data-action="row-sheet" data-list="${list}" data-row="${k}"><span class="sw"></span>${esc(rowLabel(list, rows[k], k))}</button></li>`).join("");
  return `<div class="coverage"><div class="eyebrow" style="margin-bottom:6px">${esc(t("coverage"))}</div>
    <div class="bar">${lanes}${gaps}</div><div class="lbls"><span>${ymFromIndex(w.start)}</span><span>${ymFromIndex(w.end)}</span></div>
    ${legend ? `<ul class="cov-legend">${legend}</ul>` : ""}
    <div class="small" style="margin-top:6px;color:${w.gaps.length ? "var(--danger)" : "var(--accent)"}">${w.gaps.length ? w.gaps.slice(0, 3).map(([a, b]) => esc(t("gapFound", { from: a, to: b }))).join("<br>") : esc(t("noGaps"))}</div></div>`;
}
// Bottom sheet for one period, opened from its line in the coverage bar. Its inputs carry the
// same data-list/data-row/data-col as the list, so the usual input handlers save them.
function workWhen(r) {
  const a = monthIndex(r.from), now = new Date();
  const b = r.present ? now.getUTCFullYear() * 12 + now.getUTCMonth() : monthIndex(r.to);
  const n = a != null && b != null && b >= a ? b - a + 1 : 0;
  return `${r.from || "?"} – ${r.present ? t("present") : r.to || "?"}${n ? ` · ${t("months", { n: faDigits(n) })}` : ""}`;
}
function sheetHeadHTML(list, i) {
  const r = S.data.answers[list][i];
  return `<span class="sw"></span><div class="grow"><h3 id="ws-title">${esc(rowLabel(list, r, i))}</h3><div class="small muted">${esc(workWhen(r))}</div></div>
    <button class="iconbtn" data-action="modal-close" aria-label="${esc(t("close"))}">${ic("x")}</button>`;
}
function openSheet(list, i, still = false) {
  const rows = S.data.answers[list];
  const r = rows[i];
  if (!r) return;
  const c = rowColors(rows)[i];
  const max = todayISO().slice(0, 7);
  const attrs = (col) => `id="ws-${col}" data-list="${list}" data-row="${i}" data-col="${col}"`;
  const field = (col, cls = "") => `<div class="${cls}"><label for="ws-${col}">${esc(t(col))}</label><input class="input" ${attrs(col)} value="${esc(r[col] || "")}"></div>`;
  $("#modal-root").innerHTML = `<div class="sheet-back ${still ? "still" : ""}" data-action="modal-close">
    <div class="sheet wc${c} ${still ? "still" : ""}" id="row-sheet" role="dialog" aria-modal="true" aria-labelledby="ws-title" tabindex="-1" data-stop>
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head" id="ws-head">${sheetHeadHTML(list, i)}</div>
      <div class="sheet-body">
        <div><label for="ws-from">${esc(t("from"))}</label><input class="input" type="month" ${attrs("from")} value="${esc(r.from || "")}" min="1950-01" max="${max}"></div>
        <div><label for="ws-to">${esc(t("to"))}</label><input class="input" type="month" ${attrs("to")} value="${esc(r.to || "")}" ${r.present ? "disabled" : ""} max="${max}">
          <label class="present"><input type="checkbox" id="ws-present" data-list="${list}" data-row="${i}" data-col="present" ${r.present ? "checked" : ""}>${esc(t("present"))}</label></div>
        ${LISTS[list].cols.map(([col, cls]) => field(col, cls || "")).join("")}
      </div>
      <div class="sheet-foot">
        <button class="btn danger" data-action="row-sheet-rm" data-list="${list}" data-row="${i}">${ic("trash")}${esc(t("remove"))}</button>
        <button class="btn accent" data-action="modal-close">${esc(t("done"))}</button>
      </div>
    </div></div>`;
  if (!still) $("#row-sheet").focus();
}
function closeModal() {
  const root = $("#modal-root");
  const wasSheet = !!root?.querySelector("#row-sheet");
  if (root) root.innerHTML = "";
  S.armed = null;
  if (wasSheet) renderPanel(); // the list behind it still shows the values from before the edit
}
function timelineHTML(list) {
  const cfg = LISTS[list];
  const rows = S.data.answers[list];
  const cols = rowColors(rows);
  const max = todayISO().slice(0, 7);
  const attrs = (i, col) => `id="${list}-${i}-${col}" data-list="${list}" data-row="${i}" data-col="${col}"`;
  return `<div class="q">
    <div data-cov="${list}">${coverageHTML(list)}</div>
    <div class="stack" style="gap:10px">${workOrder(rows).map((i) => { const r = rows[i]; return `
      <div class="work-row wc${cols[i]}">
        <div><label for="${list}-${i}-from">${esc(t("from"))}</label><input class="input" type="month" ${attrs(i, "from")} value="${esc(r.from || "")}" min="1950-01" max="${max}"></div>
        <div><label for="${list}-${i}-to">${esc(t("to"))}</label><input class="input" type="month" ${attrs(i, "to")} value="${esc(r.to || "")}" ${r.present ? "disabled" : ""} max="${max}">
          <label class="present"><input type="checkbox" id="${list}-${i}-present" data-list="${list}" data-row="${i}" data-col="present" ${r.present ? "checked" : ""}>${esc(t("present"))}</label></div>
        ${cfg.cols.map(([col]) => `<div><label for="${list}-${i}-${col}">${esc(t(col))}</label><input class="input" ${attrs(i, col)} value="${esc(r[col] || "")}"></div>`).join("")}
        <button class="iconbtn rm" data-action="row-rm" data-list="${list}" data-row="${i}" aria-label="${esc(t("remove"))}">${ic("trash")}</button>
      </div>`; }).join("")}</div>
    <div class="row" style="margin-top:6px">
      <button class="btn" data-action="row-add" data-list="${list}">${ic("plus")}${esc(t(cfg.add))}</button>
      ${cfg.quick ? `<div class="qs-chips">${cfg.quick.map(([en, fa]) => `<button data-action="row-quick" data-list="${list}" data-val="${esc(en)}">+ ${esc(LANG === "fa" ? fa : en)}</button>`).join("")}</div>` : ""}
    </div></div>`;
}
// Exact-date rows: trips outside Canada, and time in Canada before PR.
function daysHTML(list) {
  const cfg = LISTS[list];
  const rows = S.data.answers[list];
  const none = list === "trips" && S.data.answers.noTrips;
  const order = rows.map((r, k) => k).sort((x, y) => String(rows[y][cfg.a] || "").localeCompare(String(rows[x][cfg.a] || "")) || x - y);
  const total = rows.reduce((s, r) => { const n = rowDays(list, r); return s + (n > 0 ? n : 0); }, 0);
  const attrs = (i, col) => `id="${list}-${i}-${col}" data-list="${list}" data-row="${i}" data-col="${col}"`;
  const max = cfg.away ? "" : `max="${todayISO()}"`;
  const cell = (i, r, [col, opts]) => opts
    ? `<div><label for="${list}-${i}-${col}">${esc(t(col))}</label><select class="input" ${attrs(i, col)}><option value=""></option>${opts.map(([v, lb]) => `<option value="${esc(v)}" ${r[col] === v ? "selected" : ""}>${esc(L(lb))}</option>`).join("")}</select></div>`
    : `<div><label for="${list}-${i}-${col}">${esc(t(col))}</label><input class="input" ${attrs(i, col)} value="${esc(r[col] || "")}"></div>`;
  return `${list === "trips" ? `<label class="present none-tog"><input type="checkbox" data-flag="noTrips" ${none ? "checked" : ""}>${esc(t("noTripsLbl"))}</label>` : ""}
    ${none ? "" : `<div class="stack" style="gap:10px;margin-top:8px">${order.map((i) => { const r = rows[i]; const n = rowDays(list, r); return `
      <div class="work-row day-row ${list}">
        <div><label for="${list}-${i}-${cfg.a}">${esc(t(cfg.a))}</label><input class="input" type="date" ${attrs(i, cfg.a)} value="${esc(r[cfg.a] || "")}" min="1990-01-01" ${max}></div>
        <div><label for="${list}-${i}-${cfg.b}">${esc(t(cfg.b))}</label><input class="input" type="date" ${attrs(i, cfg.b)} value="${esc(r[cfg.b] || "")}" min="1990-01-01" ${max}></div>
        ${cfg.cols.map((c) => cell(i, r, c)).join("")}
        <div class="days ${n === -1 ? "bad" : ""}">${n == null ? "" : n === -1 ? esc(t("rowBad")) : esc(cfg.away ? t("awayN", { n: faDigits(n) }) : t("daysN", { n: faDigits(n) }))}</div>
        <button class="iconbtn rm" data-action="row-rm" data-list="${list}" data-row="${i}" aria-label="${esc(t("remove"))}">${ic("trash")}</button>
      </div>`; }).join("")}</div>
    <div class="row" style="margin-top:6px"><button class="btn" data-action="row-add" data-list="${list}">${ic("plus")}${esc(t(cfg.add))}</button>
      ${total ? `<span class="small muted">${esc(cfg.away ? t("awayN", { n: faDigits(total) }) : t("daysN", { n: faDigits(total) }))}</span>` : ""}</div>`}`;
}

/* ---------------- documents ---------------- */
function fileTile(f, i, showPage) {
  const isImg = f.type.startsWith("image/");
  return `<button class="thumb" data-action="view" data-id="${f.id}" title="${esc(f.name)} · ${fmtSize(f.size)}">
    ${showPage ? `<span class="pg">${faDigits(i + 1)}</span>` : ""}
    <span class="img">${isImg ? `<img alt="" data-thumb="${f.id}">` : ic(f.type === "application/pdf" ? "pdf" : "file")}</span>
    <span class="cap">${esc(f.name)}</span></button>`;
}
function slotHTML(s) {
  const files = filesIn(s.id);
  const ds = docsStatus();
  let status;
  if (s.id === "passport") status = ds.passportPdf ? ["ok", t("ready")] : ["warn", t("needed")];
  else if (s.req) status = files.length ? ["ok", t("ready")] : ["warn", t("needed")];
  else if (s.id === "formDraft") status = ["plain", t("fromClaude")];
  else status = files.length ? ["ok", t("ready")] : ["plain", t("optional")];
  const missing = status[0] === "warn";
  let extra = "";
  if (s.id === "passport") {
    const pdf = filesIn("passportPdf").slice(-1)[0];
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    extra = `${pdf ? `<div class="result-row">${ic("pdf")}<div class="grow"><b>${esc(t("pdfReady"))}</b><div class="small muted">${esc(t("pages", { n: faDigits(pdf.pages || "") }))} · ${fmtSize(pdf.size)}</div></div>
      <button class="btn sm" data-action="view" data-id="${pdf.id}">${esc(t("view"))}</button></div>` : ""}
      ${imgs.length ? `<div class="row"><button class="btn ${pdf ? "" : "accent"}" data-action="build-pdf">${ic("pdf")}${esc(pdf ? t("rebuildPdf") : t("buildPdf"))}</button>
        <span class="small muted">${esc(imgs.length === 1 ? t("page1") : t("pages", { n: faDigits(imgs.length) }))}</span></div>` : ""}`;
  }
  if (s.id === "photo" && files.length) {
    const f = files[files.length - 1];
    const c = f.check || {};
    const item = (ok, label) => `<li>${ok ? ic("check", 'class="ok"') : ic("x", 'class="no"')}<span>${esc(label)}</span></li>`;
    extra = `<div class="row" style="align-items:flex-start;gap:16px"><div class="photo-frame"><img alt="" data-thumb="${f.id}"></div>
      <div><div class="eyebrow" style="margin-bottom:6px">${esc(t("photoChecks"))}</div><ul class="check-list">
        ${item(c.size, t("pcSize"))}${item(c.shape, t("pcShape"))}${item(c.file, t("pcFile"))}
        <li>${ic("alert", 'style="color:var(--warn)"')}<span>${esc(t("pcFace"))}</span></li></ul>
        <a class="small" href="${PHOTO_SPECS}" target="_blank" rel="noopener">${esc(t("photoSpecs"))}</a></div></div>`;
  }
  const showFiles = s.id === "photo" ? [] : files;
  return `<div class="card slot ${s.wide ? "wide" : ""} ${missing ? "req-missing" : ""}" data-drop="${s.id}">
    <div class="slot-head"><div><h4>${esc(L(s.title))}</h4><p>${esc(L(s.desc))}</p></div><span class="chip ${status[0]}">${esc(status[1])}</span></div>
    ${showFiles.length ? `<div class="thumbs">${showFiles.map((f, i) => fileTile(f, i, s.id === "passport")).join("")}</div>` : ""}
    ${extra}
    <div class="slot-actions">
      <button class="btn sm" data-action="pick-file" data-slot="${s.id}">${ic("upload")}${esc(t("choose"))}</button>
      ${s.camera ? `<button class="btn sm" data-action="pick-camera" data-slot="${s.id}">${ic("camera")}${esc(t("takePhoto"))}</button>` : ""}
      <span class="small muted" style="align-self:center">${esc(t("dropHere"))}</span>
    </div>
    <input type="file" hidden id="in-${s.id}" data-upload="${s.id}" accept="${s.accept}" ${s.multi ? "multiple" : ""}>
    ${s.camera ? `<input type="file" hidden id="cam-${s.id}" data-upload="${s.id}" accept="image/*" capture="${s.camera}">` : ""}
  </div>`;
}
function docsHTML() {
  return `<h2 class="display">${esc(t("docsTitle"))}</h2><p class="lede">${esc(t("docsLede"))}</p>
    <div class="docs">${SLOTS.map(slotHTML).join("")}</div>`;
}

/* ---------------- notes ---------------- */
function notesHTML() {
  const key = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘V" : "Ctrl+V";
  const notes = [...S.data.notes].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return `<h2 class="display">${esc(t("notesTitle"))}</h2><p class="lede">${esc(t("notesLede"))}</p>
    <div class="paste-hint">${ic("copy")}<span>${t("pasteHint", { key: `<kbd>${key}</kbd>` })}</span></div>
    <div class="card composer stack">
      <textarea class="input" id="note-text" placeholder="${esc(t("notePh"))}" style="min-height:140px"></textarea>
      <div class="row" style="justify-content:space-between">
        <button class="btn" data-action="pick-file" data-slot="other">${ic("upload")}${esc(t("attach"))}</button>
        <button class="btn primary" data-action="save-note">${ic("send")}${esc(t("saveNote"))}</button>
      </div>
      <input type="file" hidden id="in-other" data-upload="other" accept="image/*,application/pdf" multiple>
    </div>
    <div class="notes">${notes.length ? notes.map((n) => `
      <article class="note ${n.by === "claude" ? "claude" : ""}">
        <div class="meta"><b>${esc(n.by === "claude" ? t("fromClaudeNote") : t("fromYou"))}</b><span>${esc(fmtStamp(n.at))}</span>
          ${n.by !== "claude" ? `<span class="chip ${n.seenByClaude ? "ok" : "plain"}">${esc(n.seenByClaude ? t("seen") : t("unread"))}</span>` : ""}
          <span class="spacer"></span>${n.by !== "claude" ? `<button class="btn ghost sm danger" data-action="note-rm" data-id="${n.id}">${S.armed === "n" + n.id ? esc(t("confirmRemove")) : ic("trash")}</button>` : ""}</div>
        <div class="body" dir="auto">${esc(LANG === "fa" && n.fa ? n.fa : n.text)}</div>
        ${LANG === "fa" && !n.fa ? `<div class="small muted" style="margin-top:6px">${esc(t("noteNoFa"))}</div>` : ""}</article>`).join("") : `<p class="muted">${esc(t("noNotes"))}</p>`}</div>`;
}

/* ---------------- submit ---------------- */
function submitHTML() {
  const ck = S.data.checklist;
  const ds = docsStatus();
  const items = [
    ["account"], ["calc"], ["fill"], ["prCard", ds.prCard], ["passport", ds.passportPdf], ["lang", ds.language], ["upload"], ["sign"], ["paid"], ["confirm"], ["test"], ["oath"],
  ];
  return `<h2 class="display">${esc(t("submitTitle"))}</h2><p class="lede">${esc(t("submitLede"))}</p>
  <div class="split">
    <div class="checklist">${items.map(([k, auto]) => {
      const isAuto = auto !== undefined;
      const done = isAuto ? auto : !!ck[k];
      return `<label class="ck ${done ? "done" : ""} ${isAuto ? "auto" : ""}" for="ck-${k}">
        <input type="checkbox" id="ck-${k}" data-check="${k}" ${done ? "checked" : ""} ${isAuto ? "disabled" : ""}>
        <span><div class="t">${esc(t("ck_" + k))} ${isAuto ? `<span class="chip plain small">${esc(t("auto"))}</span>` : ""}</div><div class="d">${esc(t("ck_" + k + "D"))}</div></span></label>`;
    }).join("")}
      <div class="row" style="margin-top:8px">
        <a class="btn primary" href="${CIT_PORTAL}" target="_blank" rel="noopener">${esc(t("openPortal"))}</a>
        <a class="btn" href="${APPLY_PAGE}" target="_blank" rel="noopener">${esc(t("eligPage"))}</a>
      </div>
    </div>
    <div class="stack">
      <div class="card box"><h3 class="display">${esc(t("claudeTitle"))}</h3>
        <p class="muted small">${esc(t("claudeBody"))}</p>
        <div class="stack" style="gap:10px">
          <button class="btn accent" data-action="export">${ic("download")}${esc(t("exportBtn"))}</button>
          <button class="btn" data-action="import">${ic("upload")}${esc(t("importBtn"))}</button>
          <input type="file" hidden id="import-file" accept=".nasrin,.lapis">
        </div></div>
      <div class="card box"><h3 class="display">${esc(t("vaultTitle"))}</h3>
        <p class="small"><span class="muted">${esc(t("vaultMode"))}:</span> <span class="mono">${esc(IS_LOCAL ? t("vaultModeLocal") : S.secretRepo || S.store?.repo || "")}</span></p>
        <p class="small muted">AES-256-GCM · PBKDF2-SHA256 ${faDigits((S.vault.kdf.iter / 1000).toFixed(0))}k</p>
        <div class="row">
          <button class="btn sm" data-action="lock">${ic("lock")}${esc(t("lock"))}</button>
          ${IS_LOCAL ? "" : `<button class="btn sm danger" data-action="forget">${esc(t("forget"))}</button>`}
        </div></div>
    </div>
  </div>`;
}

/* ====================================================================== */
/* files: thumbs, viewer, upload, pdf                                      */
/* ====================================================================== */
async function fileBlob(rec) {
  const bytes = await open(S.key, await S.store.readFile(rec.id));
  return new Blob([bytes], { type: rec.type });
}
async function fileURL(rec) {
  if (S.thumbs.has(rec.id)) return S.thumbs.get(rec.id);
  const p = fileBlob(rec).then((b) => URL.createObjectURL(b));
  S.thumbs.set(rec.id, p);
  try { const u = await p; S.thumbs.set(rec.id, u); return u; } catch (e) { S.thumbs.delete(rec.id); throw e; }
}
let thumbQueue = Promise.resolve();
function hydrateThumbs() {
  document.querySelectorAll("img[data-thumb]").forEach((img) => {
    const rec = S.data.files.find((f) => f.id === img.dataset.thumb);
    if (!rec) return;
    const cached = S.thumbs.get(rec.id);
    if (typeof cached === "string") { img.src = cached; return; }
    thumbQueue = thumbQueue.then(() => fileURL(rec).then((u) => { document.querySelectorAll(`img[data-thumb="${rec.id}"]`).forEach((x) => (x.src = u)); }).catch(() => {}));
  });
}
async function viewFile(id) {
  const rec = S.data.files.find((f) => f.id === id);
  if (!rec) return;
  const root = $("#modal-root");
  const isImg = rec.type.startsWith("image/");
  const isXfa = false;
  root.innerHTML = `<div class="modal-back" data-action="modal-close"><div class="card modal" role="dialog" aria-modal="true" aria-label="${esc(rec.name)}" data-stop>
    <div class="modal-head"><span class="ttl">${esc(rec.name)} <span class="muted small">· ${fmtSize(rec.size)} · ${esc(fmtStamp(rec.addedAt))}</span></span>
      <button class="btn sm" data-action="download" data-id="${rec.id}">${ic("download")}${esc(t("download"))}</button>
      <button class="btn sm danger" data-action="file-rm" data-id="${rec.id}">${S.armed === "f" + rec.id ? esc(t("confirmRemove")) : ic("trash")}</button>
      <button class="iconbtn" data-action="modal-close" aria-label="${esc(t("close"))}">${ic("x")}</button></div>
    <div class="modal-body" id="modal-body"><p class="muted">…</p></div></div></div>`;
  try {
    const u = await fileURL(rec);
    const body = $("#modal-body");
    if (!body) return;
    if (isImg) body.innerHTML = `<img src="${u}" alt="${esc(rec.name)}">`;
    else if (isXfa) body.innerHTML = `<div style="padding:40px;text-align:center;max-width:460px">${ic("pdf", 'style="width:48px;height:48px;color:var(--ink)"')}<p>${esc(L(SLOTS.find((s) => s.id === "formDraft").desc))}</p>
      <button class="btn primary" data-action="download" data-id="${rec.id}">${ic("download")}${esc(t("download"))}</button></div>`;
    else body.innerHTML = `<iframe src="${u}" title="${esc(rec.name)}"></iframe>`;
  } catch (e) {
    const body = $("#modal-body");
    if (body) body.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}
async function downloadFile(id) {
  const rec = S.data.files.find((f) => f.id === id);
  if (!rec) return;
  const u = await fileURL(rec);
  saveAs(u, rec.name);
}
function saveAs(url, name) {
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
async function toJpeg(blob, maxSide, quality) {
  const img = await loadImage(blob);
  const w = img.naturalWidth, h = img.naturalHeight;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const out = await new Promise((r) => c.toBlob(r, "image/jpeg", quality));
  return { blob: out, w: c.width, h: c.height, srcW: w, srcH: h };
}

function toast(text, { progress = false } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(text)}</span>${progress ? '<div class="progress"><i style="width:15%"></i></div>' : ""}`;
  $("#toasts").appendChild(el);
  const api = {
    set(tx, pct) { el.firstElementChild.textContent = tx; if (pct != null && el.querySelector(".progress i")) el.querySelector(".progress i").style.width = pct + "%"; },
    done(tx, bad = false) { el.firstElementChild.textContent = tx; el.querySelector(".progress")?.remove(); if (bad) el.classList.add("bad"); setTimeout(() => el.remove(), bad ? 7000 : 3200); },
  };
  if (!progress) api.done(text);
  return api;
}

async function addFiles(slot, fileList) {
  const list = [...fileList];
  for (const file of list) {
    const tt = toast(t("encrypting", { name: file.name }), { progress: true });
    try {
      let blob = file, name = file.name || "pasted.png";
      const heic = /\.(heic|heif)$/i.test(name) || /hei[cf]/i.test(file.type);
      let type = file.type || (/\.pdf$/i.test(name) ? "application/pdf" : heic ? "image/heic" : "");
      if (!/^image\/|^application\/pdf$/.test(type)) throw new Error(t("badType"));
      let check = null;
      if (type.startsWith("image/")) {
        let j;
        try {
          j = slot === "photo" ? await toJpeg(blob, 3000, 0.92) : await toJpeg(blob, 2400, 0.86);
        } catch { throw new Error(t(heic ? "badHeic" : "badImage")); }
        if (slot === "photo") {
          const ratio = j.srcW / j.srcH;
          check = { size: j.srcW >= 420 && j.srcH >= 540, shape: Math.abs(ratio - 35 / 45) < 0.12, file: Math.min(blob.size, j.blob.size) < 4 * 1048576 };
          if (blob.size >= 4 * 1048576 || type !== "image/jpeg") { blob = j.blob; type = "image/jpeg"; name = name.replace(/\.\w+$/, "") + ".jpg"; }
        } else if (type !== "image/jpeg" || j.blob.size < blob.size) {
          blob = j.blob; type = "image/jpeg"; name = name.replace(/\.\w+$/, "") + ".jpg";
        }
      }
      tt.set(t("encrypting", { name }), 45);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const id = randomId("f_");
      const sha = await S.store.writeFile(id, await seal(S.key, bytes));
      S.thumbs.set(id, URL.createObjectURL(new Blob([bytes], { type })));
      const slotDef = SLOTS.find((s) => s.id === slot);
      mutate((d) => {
        if (slotDef && !slotDef.multi) d.files.filter((f) => f.slot === slot).forEach((f) => (f.slot = "other"));
        d.files.push({ id, slot, name, type, size: bytes.length, addedAt: nowISO(), by: "you", sha, order: Date.now(), ...(check ? { check } : {}) });
      }, { log: `Added ${name} (${L(slotDef?.title) || slot})` });
      tt.done(slot === "passport" && type === "application/pdf" && bytes.length >= IRCC_MAX ? t("pdfTooBig", { size: fmtSize(bytes.length) }) : t("uploaded", { name }), slot === "passport" && type === "application/pdf" && bytes.length >= IRCC_MAX);
    } catch (e) {
      console.warn(e);
      tt.done(t("uploadFail", { name: file.name, why: e.message }), true);
    }
  }
}

// Minimal JPEG -> PDF writer (one image per page). No third-party code needed.
function jpegsToPdf(images) {
  const te = new TextEncoder();
  const parts = [];
  let len = 0;
  const offsets = [];
  const push = (x) => { const b = typeof x === "string" ? te.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n"); push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const n = images.length;
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  images.forEach((im, i) => {
    const pageId = 3 + i * 3, contId = pageId + 1, imgId = pageId + 2;
    const W = 595, H = Math.round((595 * im.h) / im.w);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pageId, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contId} 0 R >>`));
    obj(contId, () => { push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); });
    obj(imgId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
      push(im.bytes);
      push("\nendstream");
    });
  });
  const total = 3 + n * 3;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function buildPassportPdf() {
  const pages = filesIn("passport").filter((f) => f.type.startsWith("image/"));
  if (!pages.length) return;
  const tt = toast(t("building"), { progress: true });
  try {
    const settings = [[1800, 0.82], [1500, 0.74], [1200, 0.66], [1000, 0.56], [850, 0.46]];
    let pdf = null;
    for (const [side, q] of settings) {
      const imgs = [];
      for (let i = 0; i < pages.length; i++) {
        tt.set(t("building"), Math.round((100 * i) / pages.length));
        const j = await toJpeg(await fileBlob(pages[i]), side, q);
        imgs.push({ bytes: new Uint8Array(await j.blob.arrayBuffer()), w: j.w, h: j.h });
      }
      pdf = jpegsToPdf(imgs);
      if (pdf.length < IRCC_MAX * 0.97) break;
    }
    const id = randomId("f_");
    const sha = await S.store.writeFile(id, await seal(S.key, pdf));
    const old = filesIn("passportPdf");
    mutate((d) => {
      d.files = d.files.filter((f) => f.slot !== "passportPdf");
      d.files.push({ id, slot: "passportPdf", name: "passport-all-pages.pdf", type: "application/pdf", size: pdf.length, pages: pages.length, addedAt: nowISO(), by: "you", sha });
    }, { log: `Built passport PDF (${pages.length} pages)` });
    for (const o of old) S.store.deleteFile(o.id, o.sha).catch(() => {});
    if (pdf.length >= IRCC_MAX) tt.done(t("pdfTooBig", { size: fmtSize(pdf.length) }), true);
    else tt.done(t("pdfReady") + " · " + fmtSize(pdf.length));
  } catch (e) {
    console.warn(e);
    tt.done(String(e.message || e), true);
  }
}

/* ====================================================================== */
/* export / import                                                         */
/* ====================================================================== */
async function exportForClaude() {
  const files = S.data.files;
  const tt = toast(t("exporting", { n: 0, total: files.length }), { progress: true });
  try {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      tt.set(t("exporting", { n: i + 1, total: files.length }), Math.round((100 * i) / files.length));
      const bytes = await open(S.key, await S.store.readFile(files[i].id));
      out.push({ id: files[i].id, b64: toB64(bytes) });
    }
    const bundle = { kind: "nasrin-bundle", type: "export", v: 1, createdAt: nowISO(), case: S.data, files: out };
    const sealed = await sealJSON(S.key, bundle);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const u = URL.createObjectURL(new Blob([sealed], { type: "application/octet-stream" }));
    saveAs(u, `nasrin-export-${stamp}.nasrin`);
    setTimeout(() => URL.revokeObjectURL(u), 30000);
    mutate((d) => d.notes.forEach((n) => { if (n.by !== "claude") n.exported = true; }), { log: "Exported the case for Claude", render: false });
    tt.done(t("exported"));
  } catch (e) {
    tt.done(String(e.message || e), true);
  }
}
async function importFromClaude(file) {
  const tt = toast(file.name, { progress: true });
  try {
    let bundle;
    try { bundle = await openJSON(S.key, new Uint8Array(await file.arrayBuffer())); } catch { throw new Error(t("importBad")); }
    if (!/^(nasrin|lapis)-bundle$/.test(bundle.kind)) throw new Error(t("importBad"));
    const shas = {};
    for (let i = 0; i < (bundle.files || []).length; i++) {
      const f = bundle.files[i];
      tt.set(file.name, Math.round((100 * i) / bundle.files.length));
      shas[f.id] = await S.store.writeFile(f.id, await seal(S.key, fromB64(f.b64)));
    }
    if (bundle.type === "patch") {
      const p = bundle.patch || {};
      mutate((d) => {
        if (p.answers) Object.assign(d.answers, p.answers);
        if (p.ids) Object.assign(d.ids, p.ids);
        if (p.checklist) Object.assign(d.checklist, p.checklist);
        if (p.profile) deepMerge(d.profile, p.profile);
        if (p.application) deepMerge(d.application, p.application);
        for (const n of p.notes || []) d.notes.push({ id: randomId("n_"), at: nowISO(), by: "claude", ...n });
        for (const [id, st] of Object.entries(p.noteStatus || {})) { const n = d.notes.find((x) => x.id === id); if (n && st === "seen") n.seenByClaude = true; }
        for (const id of p.removeFiles || []) d.files = d.files.filter((f) => f.id !== id);
        for (const f of p.addFiles || []) d.files.push({ ...f, sha: shas[f.id] });
        d.log.unshift({ at: nowISO(), by: "claude", text: p.log || "Applied an update from Claude." });
      });
    } else if (bundle.case) {
      S.data = bundle.case; normalize();
      S.data.files.forEach((f) => { if (shas[f.id]) f.sha = shas[f.id]; });
      mutate(() => {}, { log: "Restored the case from a backup file." });
    }
    tt.done(t("imported"));
  } catch (e) {
    tt.done(String(e.message || e), true);
  }
}
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") deepMerge(a[k], v);
    else a[k] = v;
  }
}

/* ====================================================================== */
/* events                                                                  */
/* ====================================================================== */
function setAnswer(id, value, st, opts) {
  mutate((d) => {
    const tgt = st === "ids" ? d.ids : d.answers;
    tgt[id] = value;
  }, opts);
}
const actions = {
  lang(el) {
    LANG = el.dataset.lang; store.set("nasrin.lang", LANG); applyLang();
    if (S.data) renderMain(); else if ($("#lock-form")) renderLock(); else renderSetup($("#seed-file") ? 2 : 1);
  },
  theme() {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    store.set("nasrin.theme", cur === "dark" ? "light" : "dark"); applyTheme(); renderTop();
  },
  "pw-toggle"(el) {
    const p = $("#p");
    p.type = p.type === "password" ? "text" : "password";
    el.textContent = p.type === "password" ? t("show") : t("hide");
  },
  lock() { lockNow(); },
  forget() { store.set("nasrin.secret", null); toast(t("forgotten")); },
  tab(el, ev) { ev.preventDefault(); S.tab = el.dataset.tab; store.set("nasrin.tab", S.tab); renderTabs(); renderPanel(); window.scrollTo({ top: 0, behavior: "smooth" }); },
  goto(el) {
    S.tab = el.dataset.tab; if (el.dataset.group) S.group = el.dataset.group;
    store.set("nasrin.tab", S.tab); renderTabs(); renderPanel(); window.scrollTo({ top: 0, behavior: "smooth" });
  },
  step(el) {
    const s = steps()[Number(el.dataset.step)];
    S.tab = s.tab; if (s.group) S.group = s.group;
        renderTabs(); renderPanel(); $("#panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  group(el) { S.group = el.dataset.group; S.jalOpen = null; renderPanel(); $("#panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); },
  pick(el) {
    const { id, val, store: st } = el.dataset;
    mutate((d) => { const tgt = st === "ids" ? d.ids : d.answers; tgt[id] = val; delete tgt[id + "Unsure"]; });
  },
  "pick-unsure"(el) {
    const { id, store: st } = el.dataset;
    mutate((d) => { const tgt = st === "ids" ? d.ids : d.answers; tgt[id + "Unsure"] = !tgt[id + "Unsure"]; });
  },
  "jal-open"(el) { S.jalOpen = S.jalOpen === el.dataset.id ? null : el.dataset.id; renderPanel(); setTimeout(() => $(`#jy-${el.dataset.id}`)?.focus(), 30); },
  "jal-use"(el) {
    const id = el.dataset.id;
    const n = (s) => Number(String($(s).value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const iso = jalaliToISO(n(`#jy-${id}`), n(`#jm-${id}`), n(`#jd-${id}`));
    if (!iso) { $(`#jal-err-${id}`).innerHTML = `<span style="color:var(--danger)">${esc(t("jalaliBad"))}</span>`; return; }
    S.jalOpen = null;
    setAnswer(id, iso, el.dataset.store);
  },
  copy(el) {
    const v = S.data.ids[el.dataset.copy] || "";
    const done = () => { el.innerHTML = ic("check") + esc(t("copied")); setTimeout(() => (el.innerHTML = ic("copy") + esc(t("copy"))), 1600); };
    navigator.clipboard?.writeText(v).then(done, () => { const i = $(`#f-${el.dataset.copy}`); i?.select(); });
  },
  "row-add"(el) {
    const list = el.dataset.list, cfg = LISTS[list];
    const blank = cfg.kind === "timeline" ? { from: "", to: "", present: false } : { [cfg.a]: "", [cfg.b]: "" };
    for (const [c] of cfg.cols) blank[c] = "";
    mutate((d) => d.answers[list].push(blank));
  },
  "row-quick"(el) {
    const list = el.dataset.list;
    mutate((d) => {
      const rows = d.answers[list];
      const last = [...rows].sort((a, b) => String(b.to || "9999").localeCompare(String(a.to || "9999")))[0];
      const from = last && last.to && !last.present ? ymFromIndex(monthIndex(last.to) + 1) : rows.length ? "" : ymFromIndex(workWindowStart());
      rows.push({ from, to: "", present: false, activity: el.dataset.val, employer: "", city: S.data.profile.city || "", country: "Canada" });
    });
  },
  "row-rm"(el) { mutate((d) => d.answers[el.dataset.list].splice(Number(el.dataset.row), 1)); },
  "row-sheet"(el) { S.armed = null; openSheet(el.dataset.list, Number(el.dataset.row)); },
  "row-sheet-rm"(el) {
    const i = Number(el.dataset.row), list = el.dataset.list;
    if (S.armed !== "w" + list + i) { S.armed = "w" + list + i; el.classList.add("armed"); el.textContent = t("confirmRemove"); return; }
    S.armed = null;
    $("#modal-root").innerHTML = "";
    mutate((d) => d.answers[list].splice(i, 1));
  },
  year(el) {
    const { id, val } = el.dataset;
    mutate((d) => {
      const cur = Array.isArray(d.answers[id]) ? d.answers[id] : [];
      d.answers[id] = cur.includes(val) ? cur.filter((y) => y !== val) : [...cur, val].sort();
      delete d.answers[id + "Unsure"];
    });
  },
  "pick-file"(el) { $(`#in-${el.dataset.slot}`)?.click(); },
  "pick-camera"(el) { $(`#cam-${el.dataset.slot}`)?.click(); },
  "build-pdf"() { buildPassportPdf(); },
  view(el) { S.armed = null; viewFile(el.dataset.id); },
  download(el) { downloadFile(el.dataset.id); },
  "modal-close"(el, ev) { if (el.querySelector("[data-stop]") && ev.target.closest("[data-stop]")) return; closeModal(); },
  "file-rm"(el) {
    const id = el.dataset.id;
    if (S.armed !== "f" + id) { S.armed = "f" + id; el.classList.add("armed"); el.textContent = t("confirmRemove"); return; }
    S.armed = null;
    const rec = S.data.files.find((f) => f.id === id);
    $("#modal-root").innerHTML = "";
    mutate((d) => { d.files = d.files.filter((f) => f.id !== id); }, { log: `Deleted ${rec?.name || "a file"}` });
    S.store.deleteFile(id, rec?.sha).catch((e) => console.warn(e));
  },
  "save-note"() {
    const ta = $("#note-text");
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    mutate((d) => d.notes.push({ id: randomId("n_"), at: nowISO(), by: "you", text }), { log: "Added a note for Claude" });
    toast(t("noteSaved"));
  },
  "note-rm"(el) {
    const id = el.dataset.id;
    if (S.armed !== "n" + id) { S.armed = "n" + id; renderPanel(); return; }
    S.armed = null;
    mutate((d) => { d.notes = d.notes.filter((n) => n.id !== id); });
  },
  export() { exportForClaude(); },
  import() { $("#import-file").click(); },
};
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) { if (S.armed && !ev.target.closest(".danger")) { S.armed = null; } return; }
  const fn = actions[el.dataset.action];
  if (fn) fn(el, ev);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && $("#modal-root")?.innerHTML) closeModal();
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.ans) {
    setAnswer(el.dataset.ans, el.value, el.dataset.store, { render: false });
    if (el.type === "date") { const j = $(`#jal-${el.dataset.ans}`); if (j) j.textContent = jalaliLabel(el.value); }
  } else if (el.dataset.list && el.dataset.row != null && el.dataset.col && el.type !== "checkbox") {
    const list = el.dataset.list, i = Number(el.dataset.row), c = el.dataset.col;
    mutate((d) => { d.answers[list][i][c] = el.value; }, { render: false });
    const head = $("#ws-head");
    if (head && el.closest("#row-sheet")) head.innerHTML = sheetHeadHTML(list, i);
  }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.unsure) {
    mutate((d) => { const tgt = el.dataset.store === "ids" ? d.ids : d.answers; tgt[el.dataset.unsure + "Unsure"] = el.checked; }, { render: false });
  } else if (el.dataset.flag) {
    mutate((d) => { d.answers[el.dataset.flag] = el.checked; });
  } else if (el.dataset.list && el.dataset.col === "present") {
    const list = el.dataset.list, i = Number(el.dataset.row);
    mutate((d) => { d.answers[list][i].present = el.checked; });
    if (el.closest("#row-sheet")) openSheet(list, i, true);
  } else if (el.dataset.check) {
    mutate((d) => { d.checklist[el.dataset.check] = el.checked; }, { log: `${el.checked ? "Ticked" : "Unticked"}: ${T.en["ck_" + el.dataset.check]}` });
  } else if (el.dataset.upload && el.files?.length) {
    addFiles(el.dataset.upload, el.files);
    el.value = "";
  } else if (el.id === "import-file" && el.files?.[0]) {
    importFromClaude(el.files[0]);
    el.value = "";
  } else if (el.dataset.ans && (el.type === "date" || el.type === "month")) {
    renderPanel(); renderSeal();
  } else if (el.dataset.list && LISTS[el.dataset.list]?.kind === "days" && (el.type === "date" || el.tagName === "SELECT")) {
    renderPanel(); renderSeal();
  }
});
// drag & drop onto document slots
document.addEventListener("dragover", (ev) => {
  const z = ev.target.closest?.("[data-drop]");
  if (!z || !S.data) return;
  ev.preventDefault();
  document.querySelectorAll("[data-drop].over").forEach((x) => x !== z && x.classList.remove("over"));
  z.classList.add("over");
});
document.addEventListener("dragleave", (ev) => { const z = ev.target.closest?.("[data-drop]"); if (z && !z.contains(ev.relatedTarget)) z.classList.remove("over"); });
document.addEventListener("drop", (ev) => {
  const z = ev.target.closest?.("[data-drop]");
  if (!z || !S.data) return;
  ev.preventDefault();
  z.classList.remove("over");
  if (ev.dataTransfer.files.length) addFiles(z.dataset.drop, ev.dataTransfer.files);
});
// paste anywhere
document.addEventListener("paste", (ev) => {
  if (!S.data) return;
  const items = [...(ev.clipboardData?.items || [])];
  const imgs = items.filter((i) => i.kind === "file" && /^image\/|application\/pdf/.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
  const inField = ev.target.closest?.("input, textarea");
  if (imgs.length) {
    ev.preventDefault();
    const slot = ev.target.closest?.("[data-drop]")?.dataset.drop || "other";
    imgs.forEach((f, i) => { if (!f.name || f.name === "image.png") Object.defineProperty(f, "name", { value: `pasted-${Date.now()}-${i}.png` }); });
    addFiles(slot, imgs);
    if (slot === "other") toast(t("pastedImage"));
    return;
  }
  if (inField) return;
  const text = ev.clipboardData?.getData("text/plain");
  if (text) {
    ev.preventDefault();
    S.tab = "notes"; renderTabs(); renderPanel();
    const ta = $("#note-text");
    ta.value = text; ta.focus();
  }
});

/* ====================================================================== */
/* idle lock                                                               */
/* ====================================================================== */
let idleTimer = 0;
function armIdle() {
  const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => lockNow(t("idleLocked")), IDLE_MS); };
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => window.addEventListener(e, reset, { passive: true }));
  reset();
}
async function lockNow(msg) {
  if (S.pending.length) { try { await saveNow(); } catch { /* best effort */ } }
  for (const u of S.thumbs.values()) if (typeof u === "string") URL.revokeObjectURL(u);
  if (msg) sessionStorage.setItem("nasrin.msg", msg);
  location.reload();
}
// refresh from storage when returning to the tab (another device may have changed things)
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !S.data || S.pending.length || S.saving) return;
  try {
    const got = await S.store.readCase();
    if (got && got.sha !== S.sha) { S.data = await openJSON(S.key, got.bytes); S.sha = got.sha; normalize(); renderMain(); }
  } catch { /* offline; ignore */ }
});
setInterval(() => { if (S.data) renderSeal(); }, 60 * 60 * 1000);

/* ====================================================================== */
/* boot                                                                    */
/* ====================================================================== */
(async function boot() {
  applyLang();
  applyTheme();
  try {
    S.vault = await loadVault();
  } catch {
    app().innerHTML = `<div class="gate"><div class="card gate-card"><h1 class="display">${esc(t("brand"))}</h1><p class="sub">${esc(t("noVault"))}</p></div></div>`;
    return;
  }
  let msg = "";
  try { msg = sessionStorage.getItem("nasrin.msg") || ""; sessionStorage.removeItem("nasrin.msg"); } catch { /* ignore */ }
  renderLock(msg);
})();
