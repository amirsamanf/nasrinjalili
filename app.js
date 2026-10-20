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
const WORK_YEARS = 10;
const IRCC_SIGNIN = "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html";
const IRAN_PAGE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/iran.html";
const PHOTO_SPECS = "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html";
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
    vaultSub: "Private case vault",
    unlockSub: "Sign in to open the encrypted file.",
    username: "Username", password: "Password", show: "Show", hide: "Hide",
    unlock: "Unlock", unlocking: "Unlocking…",
    wrong: "That username or password doesn't match. Check for typos and try again.",
    gateFoot: "Everything is encrypted on this device before it's stored. Without the password the data is unreadable, even to GitHub.",
    noVault: "This site isn't set up yet: vault.json is missing.",
    lock: "Lock", theme: "Theme",
    saved: "Encrypted · saved", saving: "Saving…", offline: "Couldn't save · retrying", pending: "Saving soon…", local: "Test mode · this browser only",
    tabOverview: "Overview", tabGaps: "Fill the gaps", tabDocs: "Documents", tabNotes: "Notes & paste", tabSubmit: "Submit",
    daysLeft: "days left", submitBy: "Submit by", permitEnds: "Permit ends", deadline: "Deadline", progress: "Progress",
    caseTitle: "Open work permit extension",
    // steps
    s_eligible: "Eligibility confirmed", s_account: "IRCC account ready", s_checklist: "Checklist created", s_draft: "Form pre-filled",
    s_answers: "Missing answers", s_ids: "ID numbers typed", s_docs: "Documents ready", s_submit: "Submitted & paid",
    // overview
    ovTitle: "Where things stand",
    ovStatus: "{days} days to submit. {done} of 8 steps are done.",
    ovNextIs: "Next:",
    nextTitle: "Do these next",
    factsTitle: "What we know",
    logTitle: "Recent activity",
    policyTitle: "The policy",
    policyBody: "Temporary public policy for Iranian nationals in Canada. Open until Mar 31, 2027. One extension of up to 2 years.",
    fPermit: "Current permit", fPassport: "New passport", fBio: "Biometrics", fFees: "Fees", fAddress: "Address", fDaughter: "Daughter in Canada", fContact: "Contact", fDraft: "IRCC draft",
    validTo: "valid to", issued: "issued", expires: "expires", noFee: "no biometrics fee",
    unitFlag: "Work permit says {unitAlt}. Confirm in Fill the gaps.",
    draftKept: "kept until",
    nxAnswers: "Answer {n} more questions", nxAnswersD: "Husband's dates, arrivals, education, work history, background.",
    nxIds: "Type the ID numbers", nxIdsD: "Passport, UCI, national ID. Only she enters these.",
    nxPassport: "Photograph every passport page", nxPassportD: "We'll combine them into one PDF for IRCC.",
    nxPhoto: "Add a digital photo", nxPhotoD: "Front-facing, plain light background, taken recently.",
    nxForm: "Finish and validate the IMM 5710", nxFormD: "Open the draft in Adobe, complete it, click Validate, upload it here.",
    nxSubmit: "Submit and pay on IRCC", nxSubmitD: "Upload the documents, sign, pay $255.",
    nxClaude: "Send updates to Claude", nxClaudeD: "Export when you've added new answers or files.",
    allDone: "Everything is done. Keep the IRCC confirmation safe.",
    // gaps
    gapsTitle: "Fill the gaps",
    gapsLede: "Answers save automatically and stay encrypted. If you're not sure about something, tick \"Not sure\" and Claude will follow up.",
    notSure: "Not sure", yes: "Yes", no: "No", details: "Details",
    nextGroup: "Next section", prevGroup: "Back", allAnswered: "All sections answered",
    jalaliEnter: "Persian date", jalaliUse: "Use this date", jalaliYear: "سال", jalaliMonth: "ماه", jalaliDay: "روز",
    jalaliBad: "That Persian date doesn't exist. Check the numbers.",
    addRow: "Add a period", present: "to now", from: "From", to: "To", activity: "Job or activity", employer: "Employer", city: "City", country: "Country",
    coverage: "Coverage, last 10 years", gapFound: "Missing period: {from} to {to}", noGaps: "No gaps. Every month is covered.",
    copy: "Copy", copied: "Copied",
    idsNote: "Claude never types ID numbers. Enter them here once, then use Copy when filling the form in Adobe.",
    // docs
    docsTitle: "Documents",
    docsLede: "Drop files on a box, choose them, or take a photo with your phone. Each file is encrypted before upload.",
    choose: "Choose files", takePhoto: "Take photo", dropHere: "Drop files here",
    needed: "Needed", ready: "Ready", optional: "Optional", fromClaude: "From Claude",
    buildPdf: "Combine into one PDF", rebuildPdf: "Rebuild the PDF", pdfReady: "Combined passport PDF",
    pages: "{n} pages", page1: "1 page", building: "Building PDF…",
    view: "View", download: "Download", remove: "Delete", confirmRemove: "Tap again to delete", close: "Close",
    photoChecks: "Photo check", pcSize: "At least 420 × 540 pixels", pcShape: "Portrait shape (35 × 45)", pcFile: "File under 4 MB", pcFace: "Face inside the dashed oval",
    photoSpecs: "IRCC photo rules",
    encrypting: "Encrypting {name}…", uploaded: "Saved {name}", uploadFail: "Couldn't save {name}: {why}",
    badType: "only photos (JPG, PNG) or PDFs work here", tooBig: "file is larger than 15 MB", badImage: "this image format can't be read. Export it as JPG and try again",
    // notes
    notesTitle: "Notes & paste",
    notesLede: "Paste or type anything Claude should know: dates, answers, text from emails, screenshots. Claude reads these the next time you export.",
    pasteHint: "Press {key} anywhere on this site to paste text or a screenshot.",
    notePh: "e.g. Husband born 1338/05/12. Married in Tehran in 1985. She landed at YVR on 2023-03-14…",
    saveNote: "Save note", noteSaved: "Note saved", attach: "Attach images",
    noNotes: "No notes yet. Your first note will appear here.",
    fromYou: "From you", fromClaudeNote: "From Claude", seen: "Read by Claude", unread: "New",
    pastedImage: "Pasted image saved to Documents → Anything else",
    // submit
    submitTitle: "Submit",
    submitLede: "The final steps on IRCC. Tick each one as she finishes it.",
    ck_adobe: "Finish the IMM 5710 in Adobe", ck_adobeD: "Type the ID numbers and copy the answers from Fill the gaps.",
    ck_validate: "Click Validate, then Save", ck_validateD: "Barcodes appear on the last page when it's valid.",
    ck_form: "Upload the validated form here", ck_formD: "Documents → IMM 5710. Lets Claude double-check it.",
    ck_passport: "Passport PDF ready", ck_passportD: "All pages in one file, under 4 MB.",
    ck_photo: "Digital photo ready", ck_photoD: "Documents → Digital photo.",
    ck_ircc: "Upload everything to IRCC", ck_irccD: "Sign in → Continue application → upload form, passport, photo, letter.",
    ck_sign: "Sign electronically", ck_signD: "Type her name exactly as on the passport.",
    ck_paid: "Pay $255 by card", ck_paidD: "Work permit $155 + open work permit holder $100.",
    ck_confirm: "Save the confirmation and receipt", ck_confirmD: "Upload them to Documents → IRCC confirmation. They prove maintained status.",
    auto: "auto",
    openIrcc: "Open IRCC sign-in", policyPage: "IRCC Iran measures",
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
  },
  fa: {
    vaultSub: "صندوق امن پرونده",
    unlockSub: "برای باز کردن پرونده رمزگذاری‌شده وارد شوید.",
    username: "نام کاربری", password: "رمز عبور", show: "نمایش", hide: "پنهان",
    unlock: "ورود", unlocking: "در حال باز کردن…",
    wrong: "نام کاربری یا رمز عبور درست نیست. دوباره با دقت وارد کنید.",
    gateFoot: "همه‌چیز پیش از ذخیره روی همین دستگاه رمزگذاری می‌شود. بدون رمز عبور، هیچ‌کس، حتی گیت‌هاب، نمی‌تواند آن را بخواند.",
    noVault: "این سایت هنوز راه‌اندازی نشده است.",
    lock: "قفل", theme: "پوسته",
    saved: "رمزگذاری و ذخیره شد", saving: "در حال ذخیره…", offline: "ذخیره نشد · تلاش دوباره", pending: "به‌زودی ذخیره می‌شود…", local: "حالت آزمایشی · فقط این مرورگر",
    tabOverview: "خلاصه", tabGaps: "تکمیل اطلاعات", tabDocs: "مدارک", tabNotes: "یادداشت‌ها", tabSubmit: "ارسال",
    daysLeft: "روز مانده", submitBy: "ارسال تا", permitEnds: "پایان مجوز", deadline: "مهلت", progress: "پیشرفت",
    caseTitle: "تمدید مجوز کار باز",
    s_eligible: "شرایط احراز شد", s_account: "حساب IRCC آماده", s_checklist: "فهرست مدارک ساخته شد", s_draft: "فرم پیش‌پر شد",
    s_answers: "پاسخ‌های باقی‌مانده", s_ids: "شماره‌های شناسایی", s_docs: "مدارک آماده", s_submit: "ارسال و پرداخت",
    ovTitle: "وضعیت پرونده",
    ovStatus: "{days} روز تا مهلت ارسال. {done} مرحله از ۸ مرحله انجام شده است.",
    ovNextIs: "قدم بعدی:",
    nextTitle: "کارهای بعدی",
    factsTitle: "اطلاعات موجود",
    logTitle: "فعالیت‌های اخیر",
    policyTitle: "سیاست موقت",
    policyBody: "سیاست موقت برای اتباع ایران در کانادا. تا ۳۱ مارس ۲۰۲۷ باز است. یک بار تمدید تا ۲ سال.",
    fPermit: "مجوز فعلی", fPassport: "گذرنامه جدید", fBio: "انگشت‌نگاری", fFees: "هزینه‌ها", fAddress: "نشانی", fDaughter: "دختر در کانادا", fContact: "تماس", fDraft: "پیش‌نویس IRCC",
    validTo: "معتبر تا", issued: "صدور", expires: "انقضا", noFee: "بدون هزینه انگشت‌نگاری",
    unitFlag: "در مجوز کار واحد {unitAlt} آمده است. در «تکمیل اطلاعات» تأیید کنید.",
    draftKept: "نگهداری تا",
    nxAnswers: "به {n} سؤال دیگر پاسخ دهید", nxAnswersD: "تاریخ‌های همسر، ورودها، تحصیلات، سوابق کار و سؤالات سابقه.",
    nxIds: "شماره‌های شناسایی را وارد کنید", nxIdsD: "گذرنامه، UCI و کد ملی. فقط خودش وارد می‌کند.",
    nxPassport: "از همه صفحات گذرنامه عکس بگیرید", nxPassportD: "همه را به یک فایل PDF برای IRCC تبدیل می‌کنیم.",
    nxPhoto: "عکس دیجیتال اضافه کنید", nxPhotoD: "از روبه‌رو، زمینه روشن و ساده، عکس جدید.",
    nxForm: "فرم IMM 5710 را کامل و تأیید کنید", nxFormD: "پیش‌نویس را در Adobe باز کنید، کامل کنید، Validate را بزنید و اینجا بارگذاری کنید.",
    nxSubmit: "ارسال و پرداخت در سایت IRCC", nxSubmitD: "مدارک را بارگذاری کنید، امضا کنید و ۲۵۵ دلار بپردازید.",
    nxClaude: "به‌روزرسانی برای Claude بفرستید", nxClaudeD: "وقتی پاسخ یا فایل تازه اضافه کردید، خروجی بگیرید.",
    allDone: "همه مراحل انجام شد. تأییدیه IRCC را نگه دارید.",
    gapsTitle: "تکمیل اطلاعات",
    gapsLede: "پاسخ‌ها خودکار و رمزگذاری‌شده ذخیره می‌شوند. اگر مطمئن نیستید، «مطمئن نیستم» را بزنید تا Claude پیگیری کند.",
    notSure: "مطمئن نیستم", yes: "بله", no: "خیر", details: "توضیحات",
    nextGroup: "بخش بعد", prevGroup: "قبلی", allAnswered: "همه بخش‌ها پاسخ داده شد",
    jalaliEnter: "تاریخ شمسی", jalaliUse: "ثبت این تاریخ", jalaliYear: "سال", jalaliMonth: "ماه", jalaliDay: "روز",
    jalaliBad: "این تاریخ شمسی وجود ندارد. اعداد را بررسی کنید.",
    addRow: "افزودن دوره", present: "تا اکنون", from: "از", to: "تا", activity: "شغل یا فعالیت", employer: "کارفرما", city: "شهر", country: "کشور",
    coverage: "پوشش ۱۰ سال اخیر", gapFound: "دوره خالی: {from} تا {to}", noGaps: "بدون فاصله. همه ماه‌ها پوشش داده شده است.",
    copy: "کپی", copied: "کپی شد",
    idsNote: "Claude هرگز شماره‌های شناسایی را وارد نمی‌کند. یک بار اینجا بنویسید و هنگام پر کردن فرم در Adobe از دکمه کپی استفاده کنید.",
    docsTitle: "مدارک",
    docsLede: "فایل را روی کادر بکشید، انتخاب کنید یا با گوشی عکس بگیرید. هر فایل پیش از بارگذاری رمزگذاری می‌شود.",
    choose: "انتخاب فایل", takePhoto: "عکس گرفتن", dropHere: "فایل‌ها را اینجا رها کنید",
    needed: "لازم", ready: "آماده", optional: "اختیاری", fromClaude: "از طرف Claude",
    buildPdf: "ساخت یک فایل PDF", rebuildPdf: "ساخت دوباره PDF", pdfReady: "PDF کامل گذرنامه",
    pages: "{n} صفحه", page1: "۱ صفحه", building: "در حال ساخت PDF…",
    view: "نمایش", download: "دانلود", remove: "حذف", confirmRemove: "برای حذف دوباره بزنید", close: "بستن",
    photoChecks: "بررسی عکس", pcSize: "دست‌کم ۴۲۰ × ۵۴۰ پیکسل", pcShape: "عمودی (۳۵ × ۴۵)", pcFile: "کمتر از ۴ مگابایت", pcFace: "صورت داخل بیضی خط‌چین",
    photoSpecs: "قوانین عکس IRCC",
    encrypting: "در حال رمزگذاری {name}…", uploaded: "{name} ذخیره شد", uploadFail: "{name} ذخیره نشد: {why}",
    badType: "فقط عکس (JPG، PNG) یا PDF", tooBig: "حجم فایل بیش از ۱۵ مگابایت است", badImage: "این قالب عکس خوانده نمی‌شود. آن را JPG کنید",
    notesTitle: "یادداشت‌ها",
    notesLede: "هر چیزی که Claude باید بداند را بنویسید یا بچسبانید: تاریخ‌ها، پاسخ‌ها، متن ایمیل، تصویر صفحه. Claude آن‌ها را در خروجی بعدی می‌خواند.",
    pasteHint: "در هر جای سایت {key} را بزنید تا متن یا تصویر چسبانده شود.",
    notePh: "مثلاً: همسرم متولد ۱۳۳۸/۰۵/۱۲. ازدواج در تهران، ۱۳۶۴. ورود به ونکوور ۲۳ اسفند ۱۴۰۱…",
    saveNote: "ذخیره یادداشت", noteSaved: "یادداشت ذخیره شد", attach: "پیوست عکس",
    noNotes: "هنوز یادداشتی نیست.",
    fromYou: "از شما", fromClaudeNote: "از Claude", seen: "خوانده شد", unread: "جدید",
    pastedImage: "تصویر در «مدارک ← سایر» ذخیره شد",
    submitTitle: "ارسال",
    submitLede: "آخرین مراحل در سایت IRCC. هر مرحله را پس از انجام تیک بزنید.",
    ck_adobe: "تکمیل فرم IMM 5710 در Adobe", ck_adobeD: "شماره‌های شناسایی را وارد و پاسخ‌ها را از «تکمیل اطلاعات» کپی کنید.",
    ck_validate: "Validate و سپس Save", ck_validateD: "وقتی فرم درست باشد، بارکدها در صفحه آخر ظاهر می‌شوند.",
    ck_form: "فرم تأییدشده را اینجا بارگذاری کنید", ck_formD: "مدارک ← IMM 5710. تا Claude آن را بررسی کند.",
    ck_passport: "PDF گذرنامه آماده", ck_passportD: "همه صفحات در یک فایل، کمتر از ۴ مگابایت.",
    ck_photo: "عکس دیجیتال آماده", ck_photoD: "مدارک ← عکس دیجیتال.",
    ck_ircc: "بارگذاری همه مدارک در IRCC", ck_irccD: "ورود ← ادامه درخواست ← بارگذاری فرم، گذرنامه، عکس و نامه.",
    ck_sign: "امضای الکترونیکی", ck_signD: "نام را دقیقاً مانند گذرنامه بنویسید.",
    ck_paid: "پرداخت ۲۵۵ دلار با کارت", ck_paidD: "مجوز کار ۱۵۵ + مجوز کار باز ۱۰۰ دلار.",
    ck_confirm: "ذخیره تأییدیه و رسید", ck_confirmD: "در مدارک ← تأییدیه IRCC بارگذاری کنید. اثبات حفظ وضعیت اقامت است.",
    auto: "خودکار",
    openIrcc: "ورود به IRCC", policyPage: "صفحه سیاست ایران",
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
  },
};

let LANG = store.get("nasrin.lang") === "fa" ? "fa" : "en";
// Fills {tokens} from the decrypted case (never from this public file).
function fill(s) {
  if (!S?.data || typeof s !== "string" || !s.includes("{")) return s;
  const p = S.data.profile;
  const gdate = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso + "T12:00:00Z")) : "");
  const map = {
    husband: p.lateHusband || "", unit: faDigits(p.address?.unit || ""), unitAlt: faDigits(p.address?.unitAlt || ""),
    street: p.address?.street || "", phone: p.phone || "",
    visaIssued: gdate(p.visa?.issued), visaIssuedFa: jalaliLabel(p.visa?.issued || ""),
    visaYear: faDigits((p.visa?.issued || "").slice(0, 4)), permitYear: faDigits((p.permit?.issued || "").slice(0, 4)),
  };
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
const GROUPS = [
  {
    id: "husband", icon: "calendar",
    title: { en: "Her late husband", fa: "همسر مرحوم" },
    intro: { en: "The form asks about previous marriages: {husband}. If you only know a date in the Persian calendar, use \"Persian date\" and it converts automatically.", fa: "فرم درباره ازدواج قبلی ({husband}) می‌پرسد. اگر تاریخ را به شمسی می‌دانید، «تاریخ شمسی» را بزنید تا خودکار تبدیل شود." },
    fields: [
      { id: "husbandDob", type: "date", label: { en: "His date of birth", fa: "تاریخ تولد ایشان" } },
      { id: "marriageDate", type: "date", label: { en: "Date of marriage", fa: "تاریخ ازدواج" } },
      { id: "deathDate", type: "date", label: { en: "Date he passed away", fa: "تاریخ درگذشت" } },
    ],
  },
  {
    id: "lang", icon: "globe",
    title: { en: "Languages", fa: "زبان‌ها" },
    intro: { en: "Her native language is already set to Farsi.", fa: "زبان مادری: فارسی (ثبت شده است)." },
    fields: [
      { id: "officialLang", type: "choice", label: { en: "Can she communicate in English or French?", fa: "آیا می‌تواند به انگلیسی یا فرانسوی ارتباط برقرار کند؟" },
        options: [["English", { en: "English", fa: "انگلیسی" }], ["French", { en: "French", fa: "فرانسوی" }], ["Both", { en: "Both", fa: "هر دو" }], ["Neither", { en: "Neither", fa: "هیچ‌کدام" }]] },
      { id: "langTest", type: YN, label: { en: "Has she taken an English or French test (IELTS, CELPIP, TEF)?", fa: "آیا آزمون زبان (آیلتس، سلپیپ، TEF) داده است؟" } },
    ],
  },
  {
    id: "entry", icon: "send",
    title: { en: "Coming to Canada", fa: "ورود به کانادا" },
    intro: { en: "Her visitor visa was issued on {visaIssued}, so the first arrival is after that.", fa: "ویزای او {visaIssuedFa} صادر شده است؛ پس اولین ورود بعد از آن است." },
    fields: [
      { id: "firstEntryDate", type: "date", min: "visa", label: { en: "Date of her first arrival in Canada", fa: "تاریخ اولین ورود به کانادا" } },
      { id: "firstEntryPlace", type: "place", label: { en: "Where she arrived (airport or border crossing)", fa: "محل ورود (فرودگاه یا مرز)" } },
      { id: "firstEntryPurpose", type: "choice", label: { en: "Purpose of that first trip", fa: "هدف اولین سفر" },
        options: [["Family Visit", { en: "Family visit", fa: "دیدار خانواده" }], ["Tourism", { en: "Tourism", fa: "گردشگری" }], ["Business", { en: "Business", fa: "کاری" }], ["Work", { en: "Work", fa: "کار" }], ["Other", { en: "Other", fa: "سایر" }]] },
      { id: "leftSince", type: YN, label: { en: "Has she left Canada and come back since then?", fa: "آیا از آن زمان از کانادا خارج شده و برگشته است؟" } },
      { id: "recentEntryDate", type: "date", min: "visa", when: (a) => a.leftSince === "yes", label: { en: "Date of her most recent arrival", fa: "تاریخ آخرین ورود" } },
      { id: "recentEntryPlace", type: "place", when: (a) => a.leftSince === "yes", label: { en: "Where she arrived most recently", fa: "محل آخرین ورود" } },
      { id: "iranSixMonths", type: YN, label: { en: "In the past 12 months, did she spend 6 months or more in Iran?", fa: "در ۱۲ ماه گذشته، ۶ ماه یا بیشتر در ایران بوده است؟" },
        hint: { en: "If yes, a medical exam is needed before submitting. Tell Claude right away.", fa: "اگر بله، پیش از ارسال معاینه پزشکی لازم است. فوراً به Claude بگویید." } },
      { id: "otherCountries", type: YN, label: { en: "In the past 5 years, did she live 6+ months in a country other than Iran and Canada?", fa: "در ۵ سال گذشته بیش از ۶ ماه در کشوری غیر از ایران و کانادا زندگی کرده است؟" } },
      { id: "otherCountriesDetail", type: "textarea", when: (a) => a.otherCountries === "yes", label: { en: "Which country, when, and her status there", fa: "کدام کشور، چه زمانی و با چه وضعیتی" } },
    ],
  },
  {
    id: "edu", icon: "pen",
    title: { en: "Education", fa: "تحصیلات" },
    intro: { en: "Only study after high school counts here.", fa: "فقط تحصیلات بعد از دبیرستان." },
    fields: [
      { id: "hasPostSecondary", type: YN, label: { en: "Did she study after high school (university, college, trade school)?", fa: "آیا بعد از دبیرستان تحصیل کرده است (دانشگاه، کالج، آموزش فنی)؟" } },
      { id: "eduFrom", type: "month", when: (a) => a.hasPostSecondary === "yes", label: { en: "From (year and month)", fa: "از (سال و ماه)" } },
      { id: "eduTo", type: "month", when: (a) => a.hasPostSecondary === "yes", label: { en: "To (year and month)", fa: "تا (سال و ماه)" } },
      { id: "eduField", type: "text", when: (a) => a.hasPostSecondary === "yes", label: { en: "Field of study", fa: "رشته تحصیلی" } },
      { id: "eduSchool", type: "text", when: (a) => a.hasPostSecondary === "yes", label: { en: "School or university", fa: "دانشگاه یا مؤسسه" } },
      { id: "eduCity", type: "text", when: (a) => a.hasPostSecondary === "yes", label: { en: "City and country", fa: "شهر و کشور" } },
    ],
  },
  {
    id: "work", icon: "file",
    title: { en: "Work & activities", fa: "کار و فعالیت‌ها" },
    intro: { en: "Every month of the last 10 years, with no gaps. Unpaid time counts: homemaker, retired, caring for family, visiting family in Canada.", fa: "همه ماه‌های ۱۰ سال اخیر، بدون فاصله. خانه‌داری، بازنشستگی و مراقبت از خانواده هم حساب می‌شود." },
    fields: [{ id: "workRows", type: "work", label: { en: "Periods", fa: "دوره‌ها" } }],
  },
  {
    id: "bg", icon: "shield",
    title: { en: "Background questions", fa: "سؤالات سابقه" },
    intro: { en: "Answer each one truthfully. Any \"Yes\" needs a short explanation. The government-position question gets close attention, so include public universities, hospitals and ministries.", fa: "به هر سؤال صادقانه پاسخ دهید. هر «بله» توضیح کوتاهی لازم دارد. سؤال سمت دولتی با دقت بررسی می‌شود؛ کار در دانشگاه، بیمارستان یا وزارتخانه دولتی هم حساب می‌شود." },
    fields: [
      { id: "bgTb", type: YN, details: true, label: { en: "In the past 2 years, has she or a family member had tuberculosis, or been in close contact with someone who has?", fa: "در ۲ سال گذشته، آیا او یا یکی از اعضای خانواده به سل مبتلا بوده یا با فرد مبتلا تماس نزدیک داشته است؟" } },
      { id: "bgHealth", type: YN, details: true, label: { en: "Does she have a physical or mental condition that would need social or health services (other than medication) in Canada?", fa: "آیا بیماری جسمی یا روانی دارد که در کانادا به خدمات درمانی یا اجتماعی (غیر از دارو) نیاز داشته باشد؟" } },
      { id: "bgOverstay", type: YN, details: true, label: { en: "Has she ever stayed past her status, or studied or worked without permission, in Canada?", fa: "آیا تا کنون در کانادا بیش از مدت مجاز مانده یا بدون اجازه کار یا تحصیل کرده است؟" } },
      { id: "bgRefused", type: YN, details: true, label: { en: "Has she ever been refused a visa or permit, denied entry, or ordered to leave any country?", fa: "آیا تا کنون ویزا یا مجوزش رد شده، از ورود منع شده یا دستور ترک کشوری را گرفته است؟" } },
      { id: "bgPrevApplied", type: YN, details: true, label: { en: "Has she applied to enter or stay in Canada before?", fa: "آیا قبلاً برای ورود یا ماندن در کانادا درخواست داده است؟" },
        hint: { en: "Her {visaYear} visitor visa and {permitYear} work permit count, so this is most likely Yes.", fa: "ویزای {visaYear} و مجوز کار {permitYear} حساب می‌شوند؛ پس به احتمال زیاد «بله» است." } },
      { id: "bgCriminal", type: YN, details: true, label: { en: "Has she ever committed, been arrested for, charged with or convicted of a crime in any country?", fa: "آیا تا کنون در هر کشوری مرتکب جرم شده، بازداشت، متهم یا محکوم شده است؟" } },
      { id: "bgMilitary", type: YN, details: true, label: { en: "Has she served in any military, militia, civil defence unit, security organization or police force?", fa: "آیا در نیروی نظامی، شبه‌نظامی، دفاع مدنی، سازمان امنیتی یا پلیس خدمت کرده است؟" } },
      { id: "bgGroups", type: YN, details: true, label: { en: "Has she been a member of, or associated with, a political party or group that used or supported violence?", fa: "آیا عضو یا مرتبط با حزب یا گروهی بوده که از خشونت استفاده یا حمایت کرده است؟" } },
      { id: "bgGovt", type: YN, details: true, label: { en: "Has she ever held a government position (civil servant, judge, police, staff of a public university or hospital)?", fa: "آیا تا کنون سمت دولتی داشته است (کارمند دولت، قاضی، پلیس، کارمند دانشگاه یا بیمارستان دولتی)؟" } },
      { id: "bgWitness", type: YN, details: true, label: { en: "Has she witnessed or taken part in ill-treatment of prisoners or civilians, looting, or desecration of religious buildings?", fa: "آیا شاهد یا شریک بدرفتاری با زندانیان یا غیرنظامیان، غارت یا هتک حرمت اماکن مذهبی بوده است؟" } },
    ],
  },
  {
    id: "confirm", icon: "check",
    title: { en: "Quick confirmations", fa: "تأییدهای سریع" },
    intro: { en: "A few things Claude assumed while filling the draft.", fa: "چند موردی که Claude هنگام پر کردن پیش‌نویس فرض کرد." },
    fields: [
      { id: "unit", type: "choice", when: () => !!S.data.profile.address.unitAlt,
        label: { en: "Which apartment number is correct at {street}?", fa: "شماره واحد درست در {street} کدام است؟" },
        hint: { en: "Her work permit says {unitAlt}. The draft form and letter use {unit}.", fa: "در مجوز کار {unitAlt} آمده و در پیش‌نویس فرم و نامه {unit}." },
        options: (d) => [d.profile.address.unit, d.profile.address.unitAlt].map((u) => [u, { en: u, fa: faDigits(u) }]) },
      { id: "otherNames", type: YN, label: { en: "Has she ever used another name or spelling (old documents, nickname)?", fa: "آیا تا کنون نام یا املای دیگری داشته است (مدارک قدیمی، نام مستعار)؟" } },
      { id: "otherNamesDetail", type: "text", when: (a) => a.otherNames === "yes", label: { en: "Other names or spellings", fa: "نام‌ها یا املاهای دیگر" } },
      { id: "phoneType", type: "choice", label: { en: "Is {phone} a cell phone or a home phone?", fa: "شماره {phone} موبایل است یا ثابت؟" },
        options: [["Cellular", { en: "Cell phone", fa: "موبایل" }], ["Residence", { en: "Home phone", fa: "تلفن ثابت" }]] },
      { id: "futureContact", type: YN, optional: true, label: { en: "Optional: may IRCC contact her in the future for research or feedback?", fa: "اختیاری: آیا IRCC می‌تواند در آینده برای پژوهش یا نظرسنجی با او تماس بگیرد؟" } },
    ],
  },
  {
    id: "ids", icon: "id", store: "ids",
    title: { en: "ID numbers", fa: "شماره‌های شناسایی" },
    intro: { en: "Claude never types ID numbers. Enter them here once, then use Copy when filling the form in Adobe.", fa: "Claude هرگز شماره‌های شناسایی را وارد نمی‌کند. یک بار اینجا بنویسید و در Adobe از دکمه کپی استفاده کنید." },
    fields: [
      { id: "uci", type: "id", label: { en: "UCI (on the work permit, top right)", fa: "شماره UCI (بالای مجوز کار)" } },
      { id: "passportNumber", type: "id", label: { en: "New passport number", fa: "شماره گذرنامه جدید" } },
      { id: "nationalId", type: "id", label: { en: "National ID number (kart-e melli)", fa: "کد ملی" } },
      { id: "nationalIdIssue", type: "date", optional: true, label: { en: "National ID card issue date (if printed)", fa: "تاریخ صدور کارت ملی (اگر درج شده)" } },
      { id: "nationalIdExpiry", type: "date", optional: true, label: { en: "National ID card expiry date (if printed)", fa: "تاریخ انقضای کارت ملی (اگر درج شده)" } },
      { id: "permitNumber", type: "id", label: { en: "Work permit number (starts with U)", fa: "شماره مجوز کار (با U شروع می‌شود)" } },
    ],
  },
];
const PLACES = ["Vancouver International Airport (YVR)", "Toronto Pearson Airport (YYZ)", "Montréal-Trudeau Airport (YUL)", "Calgary International Airport (YYC)", "Peace Arch border crossing (BC)", "Pacific Highway border crossing (BC)"];

const SLOTS = [
  { id: "passport", req: true, wide: true, accept: "image/*,application/pdf", multi: true, camera: "environment", icon: "passport",
    title: { en: "Passport, every page", fa: "گذرنامه، همه صفحات" },
    desc: { en: "Photograph every page of the new passport, blank ones too. Then combine them into one PDF for IRCC.", fa: "از همه صفحات گذرنامه جدید، حتی صفحات خالی، عکس بگیرید و سپس همه را یک PDF کنید." } },
  { id: "photo", req: true, accept: "image/jpeg,image/png", multi: false, camera: "user", icon: "camera",
    title: { en: "Digital photo", fa: "عکس دیجیتال" },
    desc: { en: "Recent, front-facing, plain light background, no glare on glasses.", fa: "جدید، از روبه‌رو، زمینه روشن و ساده، بدون انعکاس عینک." } },
  { id: "imm5710", req: true, accept: "application/pdf", multi: false, icon: "pdf",
    title: { en: "IMM 5710, validated", fa: "فرم IMM 5710، تأییدشده" },
    desc: { en: "The finished form after clicking Validate in Adobe. Barcodes on the last page mean it's valid.", fa: "فرم کامل‌شده پس از زدن Validate در Adobe. بارکد در صفحه آخر یعنی معتبر است." } },
  { id: "letter", accept: "application/pdf,image/*", multi: false, icon: "note",
    title: { en: "Letter of explanation", fa: "نامه توضیحات" },
    desc: { en: "Uploads in IRCC's optional \"Client Information\" slot.", fa: "در بخش اختیاری «Client Information» در IRCC بارگذاری می‌شود." } },
  { id: "formDraft", accept: "application/pdf", multi: true, icon: "pen",
    title: { en: "Form draft from Claude", fa: "پیش‌نویس فرم از Claude" },
    desc: { en: "Download, open in Adobe, finish it. Needs Adobe Reader; browsers can't show it.", fa: "دانلود کنید و در Adobe باز کنید. مرورگر آن را نشان نمی‌دهد." } },
  { id: "confirmation", accept: "application/pdf,image/*", multi: true, icon: "shield",
    title: { en: "IRCC confirmation & receipt", fa: "تأییدیه و رسید IRCC" },
    desc: { en: "After paying, save the confirmation page and receipt here.", fa: "پس از پرداخت، تأییدیه و رسید را اینجا ذخیره کنید." } },
  { id: "reference", accept: "image/*,application/pdf", multi: true, icon: "file",
    title: { en: "Reference documents", fa: "مدارک مرجع" },
    desc: { en: "Old passport, previous visa, current permit and the summary.", fa: "گذرنامه قدیم، ویزای قبلی، مجوز فعلی و خلاصه پرونده." } },
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
  tab: store.get("nasrin.tab") || "overview", group: "husband",
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
  const got = await S.store.readCase();
  if (!got) return renderSetup(2);
  S.data = await openJSON(S.key, got.bytes);
  S.sha = got.sha;
  normalize();
  startApp();
}
function normalize() {
  const d = S.data;
  d.answers ??= {}; d.ids ??= {}; d.checklist ??= {}; d.notes ??= []; d.files ??= []; d.log ??= [];
  if (!Array.isArray(d.answers.workRows)) d.answers.workRows = [];
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
function fieldDone(g, f) {
  if (!visible(f) || f.optional) return true;
  const a = g.store === "ids" ? S.data.ids : S.data.answers;
  if (a[f.id + "Unsure"]) return true;
  const v = a[f.id];
  if (f.type === "work") return workStatus().done;
  if (f.type === YN && f.details && v === "yes") return !!String(a[f.id + "Detail"] || "").trim();
  return v !== undefined && v !== null && String(v).trim() !== "";
}
function groupStatus(g) {
  const fs = g.fields.filter((f) => visible(f) && !f.optional);
  const done = fs.filter((f) => fieldDone(g, f)).length;
  return { done, total: fs.length, complete: done === fs.length };
}
function openQuestions(includeIds = false) {
  let n = 0;
  for (const g of GROUPS) {
    if (g.id === "ids" && !includeIds) continue;
    const s = groupStatus(g);
    n += s.total - s.done;
  }
  return n;
}
function workStatus() {
  const rows = S.data.answers.workRows || [];
  const start = workWindowStart();
  const now = new Date();
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const covered = new Array(end - start + 1).fill(false);
  let rowsOk = rows.length > 0;
  for (const r of rows) {
    const a = monthIndex(r.from);
    const b = r.present ? end : monthIndex(r.to);
    if (a == null || b == null || !String(r.activity || "").trim()) { rowsOk = false; continue; }
    for (let i = Math.max(a, start); i <= Math.min(b, end); i++) covered[i - start] = true;
  }
  const gaps = [];
  let i = 0;
  while (i < covered.length) {
    if (!covered[i]) { let j = i; while (j + 1 < covered.length && !covered[j + 1]) j++; gaps.push([ymFromIndex(start + i), ymFromIndex(start + j)]); i = j + 1; } else i++;
  }
  return { covered, gaps, start, end, done: rowsOk && gaps.length === 0 };
}
const filesIn = (slot) => S.data.files.filter((f) => f.slot === slot).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.addedAt).localeCompare(String(b.addedAt)));
function docsStatus() {
  const pass = filesIn("passport");
  return {
    passportPdf: filesIn("passportPdf").length > 0 || pass.some((f) => f.type === "application/pdf"),
    pages: pass.filter((f) => f.type.startsWith("image/")).length,
    photo: filesIn("photo").length > 0,
    form: filesIn("imm5710").length > 0,
    letter: filesIn("letter").length > 0,
    confirmation: filesIn("confirmation").length > 0,
  };
}
function steps() {
  const nonIds = GROUPS.filter((g) => g.id !== "ids");
  const answersDone = nonIds.every((g) => groupStatus(g).complete);
  const idsDone = groupStatus(GROUPS.find((g) => g.id === "ids")).complete;
  const ds = docsStatus();
  const ck = S.data.checklist;
  const list = [
    { key: "eligible", done: true, tab: "overview" },
    { key: "account", done: true, tab: "submit" },
    { key: "checklist", done: true, tab: "submit" },
    { key: "draft", done: true, tab: "docs" },
    { key: "answers", done: answersDone, tab: "gaps" },
    { key: "ids", done: idsDone, tab: "gaps", group: "ids" },
    { key: "docs", done: ds.passportPdf && ds.photo && ds.form, tab: "docs" },
    { key: "submit", done: !!(ck.ircc && ck.paid), tab: "submit" },
  ];
  const cur = list.findIndex((s) => !s.done);
  list.forEach((s, i) => (s.state = s.done ? "done" : i === cur ? "now" : "todo"));
  return list;
}
function nextActions() {
  const out = [];
  const ds = docsStatus();
  const n = openQuestions(false);
  if (n) out.push({ icon: "pen", t: t("nxAnswers", { n: faDigits(n) }), d: t("nxAnswersD"), tab: "gaps", group: GROUPS.find((g) => g.id !== "ids" && !groupStatus(g).complete)?.id });
  if (!groupStatus(GROUPS.find((g) => g.id === "ids")).complete) out.push({ icon: "id", t: t("nxIds"), d: t("nxIdsD"), tab: "gaps", group: "ids" });
  if (!ds.passportPdf) out.push({ icon: "passport", t: t("nxPassport"), d: t("nxPassportD"), tab: "docs" });
  if (!ds.photo) out.push({ icon: "camera", t: t("nxPhoto"), d: t("nxPhotoD"), tab: "docs" });
  if (!ds.form) out.push({ icon: "pdf", t: t("nxForm"), d: t("nxFormD"), tab: "docs" });
  if (!(S.data.checklist.ircc && S.data.checklist.paid)) out.push({ icon: "send", t: t("nxSubmit"), d: t("nxSubmitD"), tab: "submit" });
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
  document.title = "Nasrin";
  app().innerHTML = `
  <div class="gate">
    <form class="card gate-card" id="lock-form" autocomplete="on">
      <div class="gate-top"><span class="eyebrow">${esc(t("vaultSub"))}</span>${langSeg()}</div>
      ${logoHTML()}
      <h1 class="display">Nasrin</h1>
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
        <input class="input mono" id="sr" required placeholder="owner/nasrinjalili-vault" autocomplete="off" autocapitalize="none" spellcheck="false">
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
    <div class="gate-top"><span class="eyebrow">Nasrin</span>${langSeg()}</div>
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
  document.title = gn ? `${gn.charAt(0)}${gn.slice(1).toLowerCase()} · Work permit` : "Nasrin";
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
  const wc = $("#work-cov");
  if (wc) wc.innerHTML = coverageHTML();
}
function renderTop() {
  const el = $("#topbar");
  if (!el) return;
  const st = IS_LOCAL && S.saveState === "saved" ? "local" : S.saveState;
  const cls = { saved: "ok", local: "warn", saving: "plain", pending: "plain", offline: "bad" }[st];
  const p = S.data.profile;
  const th = document.documentElement.dataset.theme;
  el.innerHTML = `
    <a class="brand" href="#" data-action="tab" data-tab="overview" aria-label="Nasrin">${logoHTML()}<span>Nasrin</span></a>
    <div class="case-name"><b>${esc(p.givenName.charAt(0) + p.givenName.slice(1).toLowerCase())} ${esc(p.familyName.charAt(0) + p.familyName.slice(1).toLowerCase())}</b> · ${esc(t("caseTitle"))}</div>
    <div class="spacer"></div>
    <span class="chip ${cls} save-chip" title="${esc(t(st))}"><span class="txt">${esc(t(st))}</span></span>
    ${langSeg()}
    <button class="iconbtn" data-action="theme" aria-label="${esc(t("theme"))}">${ic(th === "dark" ? "sun" : "moon")}</button>
    <button class="iconbtn" data-action="lock" aria-label="${esc(t("lock"))}" title="${esc(t("lock"))}">${ic("lock")}</button>`;
}
function renderSeal() {
  const el = $("#seal");
  if (!el) return;
  const list = steps();
  const doneN = list.filter((s) => s.done).length;
  const deadline = S.data.application?.deadline || S.data.profile.permit.expires;
  const dayBefore = new Date(Date.parse(deadline + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="cd">
      <div class="eyebrow">${esc(t("deadline"))}</div>
      <div class="cd-num"><b>${faDigits(daysLeft())}</b><span>${esc(t("daysLeft"))}</span></div>
      <div class="cd-when">${esc(t("submitBy"))} <b>${fmtDate(dayBefore)}</b><br>${esc(t("permitEnds"))} <span class="end">${fmtDate(deadline)}</span></div>
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
  const ds = docsStatus();
  const docsMissing = [!ds.passportPdf, !ds.photo, !ds.form].filter(Boolean).length;
  const unread = S.data.notes.filter((x) => x.by === "claude" && !x.seenByYou).length;
  const ck = S.data.checklist;
  const subLeft = ["adobe", "validate", "ircc", "sign", "paid", "confirm"].filter((k) => !ck[k]).length;
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
  const unit = a.unit || p.address.unit;
  const unitFlag = !a.unit && p.address.note;
  const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();
  return `
  <h2 class="display">${esc(t("ovTitle"))}</h2>
  <p class="status-line">${t("ovStatus", { days: `<b>${faDigits(daysLeft())}</b>`, done: `<b>${faDigits(doneN)}</b>` })}
    ${acts[0] ? ` ${esc(t("ovNextIs"))} <b>${esc(acts[0].t)}</b>.` : ""}</p>
  <div class="card profile">
    <div class="head"><div><div class="eyebrow">${esc(t("caseTitle"))} · IMM 5710</div>
      <div class="name">${esc(title(p.givenName))} ${esc(title(p.familyName))}</div></div>
      <span class="chip ok">${esc(p.permit.type)}</span></div>
    <dl>
      <div><dt>${LANG === "fa" ? "تاریخ تولد" : "Date of birth"}</dt><dd>${fmtDate(p.dob)}</dd></div>
      <div><dt>${LANG === "fa" ? "محل تولد" : "Born in"}</dt><dd>${esc(p.birthPlace)}</dd></div>
      <div><dt>${LANG === "fa" ? "تابعیت" : "Citizenship"}</dt><dd>${esc(p.citizenship)}</dd></div>
      <div><dt>${LANG === "fa" ? "وضعیت تأهل" : "Marital status"}</dt><dd>${esc(p.maritalStatus)}</dd></div>
    </dl>
  </div>
  ${acts.length ? `<h3 class="section-title display">${esc(t("nextTitle"))}</h3>
  <div class="next-list">${acts.slice(0, 4).map((x, i) => `
    <button class="next ${i === 0 ? "first" : ""}" data-action="goto" data-tab="${x.tab}" ${x.group ? `data-group="${x.group}"` : ""}>
      <span class="n">${ic(x.icon)}</span><span><div class="t">${esc(x.t)}</div><div class="d">${esc(x.d)}</div></span><span class="go">${ic("arrow", LANG === "fa" ? 'style="transform:scaleX(-1)"' : "")}</span>
    </button>`).join("")}</div>` : `<p class="okmsg">${esc(t("allDone"))}</p>`}
  <h3 class="section-title display">${esc(t("factsTitle"))}</h3>
  <div class="grid3" style="margin-bottom:26px">
    <div class="fact"><div class="k">${esc(t("fPermit"))}</div><div class="v">${esc(p.permit.type)}</div><div class="s">${esc(t("issued"))} ${fmtDate(p.permit.issued)} · ${esc(t("expires"))} ${fmtDate(p.permit.expires)}</div></div>
    <div class="fact"><div class="k">${esc(t("fPassport"))}</div><div class="v">${esc(p.passport.country)}</div><div class="s">${esc(t("validTo"))} ${fmtDate(p.passport.expires)}</div></div>
    <div class="fact"><div class="k">${esc(t("fBio"))}</div><div class="v">${esc(p.biometrics.given)}</div><div class="s">${esc(t("validTo"))} ${esc(p.biometrics.validUntil)} · ${esc(t("noFee"))}</div></div>
    <div class="fact ${unitFlag ? "flag" : ""}"><div class="k">${esc(t("fAddress"))}</div><div class="v">${esc(unit)}-${esc(p.address.street)}</div><div class="s">${esc(p.address.city)}, ${esc(p.address.province)} ${esc(p.address.postal)}${unitFlag ? `<br>${esc(t("unitFlag"))}` : ""}</div></div>
    <div class="fact"><div class="k">${esc(t("fContact"))}</div><div class="v mono" style="font-size:15px">${esc(p.phone)}</div><div class="s" style="overflow-wrap:anywhere">${esc(p.email)}</div></div>
    <div class="fact"><div class="k">${esc(t("fDaughter"))}</div><div class="v">${esc(p.daughter.name)}</div><div class="s">${esc(p.daughter.status)} · ${fmtDate(p.daughter.dob)}</div></div>
    <div class="fact"><div class="k">${esc(t("fFees"))}</div><div class="v mono">$${d.application.fees.total} CAD</div><div class="s">$${d.application.fees.workPermit} + $${d.application.fees.openPermitHolder}</div></div>
    <div class="fact"><div class="k">${esc(t("fDraft"))}</div><div class="v">${esc(d.application.form)}</div><div class="s">${esc(t("draftKept"))} ${fmtDate(d.application.draftDeletedAfter)}</div></div>
    <div class="fact"><div class="k">${esc(t("policyTitle"))}</div><div class="v">${esc(t("caseTitle"))}</div><div class="s">${esc(t("policyBody"))}</div></div>
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
  if (f.optional || f.type === "work") return "";
  const a = g.store === "ids" ? S.data.ids : S.data.answers;
  return `<label class="unsure-tog"><input type="checkbox" id="u-${f.id}" data-unsure="${f.id}" data-store="${g.store || ""}" ${a[f.id + "Unsure"] ? "checked" : ""}>${esc(t("notSure"))}</label>`;
}
function hintHTML(f) {
  return f.hint ? `<div class="hint">${ic("alert")}<span>${esc(L(f.hint))}</span></div>` : "";
}
function fieldHTML(g, f) {
  const v = getVal(g, f) ?? "";
  const st = g.store || "";
  const lbl = `<label class="qlabel" for="f-${f.id}">${esc(L(f.label))}</label>`;
  switch (f.type) {
    case "date": {
      const jal = S.jalOpen === f.id;
      return `<div class="q">${lbl}${hintHTML(f)}
        <div class="date-row">
          <input class="input" type="date" id="f-${f.id}" data-ans="${f.id}" data-store="${st}" value="${esc(v)}" ${f.min === "visa" && S.data.profile.visa?.issued ? `min="${S.data.profile.visa.issued}"` : ""} max="${todayISO()}">
          <button class="btn sm" data-action="jal-open" data-id="${f.id}" aria-expanded="${jal}">${ic("calendar")}<span lang="fa">${esc(t("jalaliEnter"))}</span></button>
          ${unsureHTML(g, f)}
        </div>
        ${v ? `<div class="jal" id="jal-${f.id}">${esc(jalaliLabel(v))}</div>` : `<div class="jal" id="jal-${f.id}"></div>`}
        ${jal ? `<div class="jal-entry" role="group" aria-label="${esc(t("jalaliEnter"))}">
          <input class="input mono" id="jy-${f.id}" inputmode="numeric" placeholder="${t("jalaliYear")} ۱۳۴۱" aria-label="${t("jalaliYear")}">
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
    case "place":
      return `<div class="q">${lbl}${hintHTML(f)}
        <input class="input" id="f-${f.id}" data-ans="${f.id}" data-store="${st}" value="${esc(v)}" ${f.type === "place" ? 'list="places"' : ""} autocomplete="off">
        ${f.type === "place" ? `<datalist id="places">${PLACES.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}
        <div>${unsureHTML(g, f)}</div></div>`;
    case "textarea":
      return `<div class="q">${lbl}${hintHTML(f)}<textarea class="input" id="f-${f.id}" data-ans="${f.id}" data-store="${st}">${esc(v)}</textarea></div>`;
    case "id":
      return `<div class="q">${lbl}${hintHTML(f)}<div class="id-row">
        <input class="input mono" id="f-${f.id}" data-ans="${f.id}" data-store="ids" value="${esc(v)}" autocomplete="off" spellcheck="false" autocapitalize="characters">
        <button class="btn sm" data-action="copy" data-copy="${f.id}">${ic("copy")}${esc(t("copy"))}</button></div><div>${unsureHTML(g, f)}</div></div>`;
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
    case "work":
      return workHTML();
    default:
      return "";
  }
}
function coverageHTML() {
  const w = workStatus();
  const n = w.covered.length;
  let segs = "", i = 0;
  while (i < n) {
    if (w.covered[i]) { let j = i; while (j + 1 < n && w.covered[j + 1]) j++; segs += `<i style="left:${(100 * i) / n}%;width:${(100 * (j - i + 1)) / n}%"></i>`; i = j + 1; } else i++;
  }
  return `<div class="coverage"><div class="eyebrow" style="margin-bottom:6px">${esc(t("coverage"))}</div>
    <div class="bar">${segs}</div><div class="lbls"><span>${ymFromIndex(w.start)}</span><span>${ymFromIndex(w.end)}</span></div>
    <div class="small" style="margin-top:6px;color:${w.gaps.length ? "var(--danger)" : "var(--accent)"}">${w.gaps.length ? w.gaps.slice(0, 3).map(([a, b]) => esc(t("gapFound", { from: a, to: b }))).join("<br>") : esc(t("noGaps"))}</div></div>`;
}
function workHTML() {
  const rows = S.data.answers.workRows;
  const quick = [["Homemaker", "خانه‌دار"], ["Retired", "بازنشسته"], ["Unemployed", "بیکار"], ["Visiting family in Canada", "دیدار خانواده در کانادا"]];
  return `<div class="q">
    <div id="work-cov">${coverageHTML()}</div>
    <div class="stack" style="gap:10px">${rows.map((r, i) => `
      <div class="work-row">
        <div><label for="w-${i}-from">${esc(t("from"))}</label><input class="input" type="month" id="w-${i}-from" data-row="${i}" data-col="from" value="${esc(r.from || "")}" min="1950-01" max="${todayISO().slice(0, 7)}"></div>
        <div><label for="w-${i}-to">${esc(t("to"))}</label><input class="input" type="month" id="w-${i}-to" data-row="${i}" data-col="to" value="${esc(r.to || "")}" ${r.present ? "disabled" : ""} max="${todayISO().slice(0, 7)}">
          <label class="present"><input type="checkbox" id="w-${i}-present" data-row="${i}" data-col="present" ${r.present ? "checked" : ""}>${esc(t("present"))}</label></div>
        <div><label for="w-${i}-activity">${esc(t("activity"))}</label><input class="input" id="w-${i}-activity" data-row="${i}" data-col="activity" value="${esc(r.activity || "")}"></div>
        <div><label for="w-${i}-employer">${esc(t("employer"))}</label><input class="input" id="w-${i}-employer" data-row="${i}" data-col="employer" value="${esc(r.employer || "")}"></div>
        <div><label for="w-${i}-city">${esc(t("city"))}</label><input class="input" id="w-${i}-city" data-row="${i}" data-col="city" value="${esc(r.city || "")}"></div>
        <div><label for="w-${i}-country">${esc(t("country"))}</label><input class="input" id="w-${i}-country" data-row="${i}" data-col="country" value="${esc(r.country || "")}"></div>
        <button class="iconbtn rm" data-action="work-rm" data-row="${i}" aria-label="${esc(t("remove"))}">${ic("trash")}</button>
      </div>`).join("")}</div>
    <div class="row" style="margin-top:6px">
      <button class="btn" data-action="work-add">${ic("plus")}${esc(t("addRow"))}</button>
      <div class="qs-chips">${quick.map(([en, fa]) => `<button data-action="work-quick" data-val="${esc(en)}">+ ${esc(LANG === "fa" ? fa : en)}</button>`).join("")}</div>
    </div></div>`;
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
        <div class="body">${esc(n.text)}</div></article>`).join("") : `<p class="muted">${esc(t("noNotes"))}</p>`}</div>`;
}

/* ---------------- submit ---------------- */
function submitHTML() {
  const ck = S.data.checklist;
  const ds = docsStatus();
  const items = [
    ["adobe"], ["validate"], ["form", ds.form], ["passport", ds.passportPdf], ["photo", ds.photo], ["ircc"], ["sign"], ["paid"], ["confirm"],
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
        <a class="btn primary" href="${IRCC_SIGNIN}" target="_blank" rel="noopener">${esc(t("openIrcc"))}</a>
        <a class="btn" href="${IRAN_PAGE}" target="_blank" rel="noopener">${esc(t("policyPage"))}</a>
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
  const isXfa = rec.slot === "formDraft" || rec.slot === "imm5710";
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
      let blob = file, type = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : ""), name = file.name || "pasted.png";
      if (!/^image\/|^application\/pdf$/.test(type)) throw new Error(t("badType"));
      let check = null;
      if (type.startsWith("image/")) {
        let j;
        try {
          j = slot === "photo" ? await toJpeg(blob, 3000, 0.92) : await toJpeg(blob, 2400, 0.86);
        } catch { throw new Error(t("badImage")); }
        if (slot === "photo") {
          const ratio = j.srcW / j.srcH;
          check = { size: j.srcW >= 420 && j.srcH >= 540, shape: Math.abs(ratio - 35 / 45) < 0.12, file: Math.min(blob.size, j.blob.size) < 4 * 1048576 };
          if (blob.size >= 4 * 1048576 || type !== "image/jpeg") { blob = j.blob; type = "image/jpeg"; name = name.replace(/\.\w+$/, "") + ".jpg"; }
        } else if (type !== "image/jpeg" || j.blob.size < blob.size) {
          blob = j.blob; type = "image/jpeg"; name = name.replace(/\.\w+$/, "") + ".jpg";
        }
      } else if (blob.size > 15 * 1048576) throw new Error(t("tooBig"));
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
      tt.done(t("uploaded", { name }));
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
    let settings = [[1800, 0.82], [1500, 0.74], [1200, 0.66]];
    let pdf = null;
    for (const [side, q] of settings) {
      const imgs = [];
      for (let i = 0; i < pages.length; i++) {
        tt.set(t("building"), Math.round((100 * i) / pages.length));
        const j = await toJpeg(await fileBlob(pages[i]), side, q);
        imgs.push({ bytes: new Uint8Array(await j.blob.arrayBuffer()), w: j.w, h: j.h });
      }
      pdf = jpegsToPdf(imgs);
      if (pdf.length < 3.9 * 1048576) break;
    }
    const id = randomId("f_");
    const sha = await S.store.writeFile(id, await seal(S.key, pdf));
    const old = filesIn("passportPdf");
    mutate((d) => {
      d.files = d.files.filter((f) => f.slot !== "passportPdf");
      d.files.push({ id, slot: "passportPdf", name: "passport-all-pages.pdf", type: "application/pdf", size: pdf.length, pages: pages.length, addedAt: nowISO(), by: "you", sha });
    }, { log: `Built passport PDF (${pages.length} pages)` });
    for (const o of old) S.store.deleteFile(o.id, o.sha).catch(() => {});
    tt.done(t("pdfReady") + " · " + fmtSize(pdf.length));
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
    else if (s.key === "answers") S.group = GROUPS.find((g) => g.id !== "ids" && !groupStatus(g).complete)?.id || S.group;
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
  "work-add"() { mutate((d) => d.answers.workRows.push({ from: "", to: "", present: false, activity: "", employer: "", city: "", country: "" })); },
  "work-quick"(el) {
    mutate((d) => {
      const rows = d.answers.workRows;
      const last = [...rows].sort((a, b) => String(b.to || "9999").localeCompare(String(a.to || "9999")))[0];
      const from = last && last.to && !last.present ? ymFromIndex(monthIndex(last.to) + 1) : rows.length ? "" : ymFromIndex(workWindowStart());
      const inCanada = /Canada/.test(el.dataset.val);
      const city = inCanada ? S.data.profile.address.city : (S.data.profile.birthPlace || "").split(",")[0];
      const country = inCanada ? "Canada" : S.data.profile.citizenship;
      rows.push({ from, to: "", present: false, activity: el.dataset.val, employer: "", city, country });
    });
  },
  "work-rm"(el) { mutate((d) => d.answers.workRows.splice(Number(el.dataset.row), 1)); },
  "pick-file"(el) { $(`#in-${el.dataset.slot}`)?.click(); },
  "pick-camera"(el) { $(`#cam-${el.dataset.slot}`)?.click(); },
  "build-pdf"() { buildPassportPdf(); },
  view(el) { S.armed = null; viewFile(el.dataset.id); },
  download(el) { downloadFile(el.dataset.id); },
  "modal-close"(el, ev) { if (ev.target.closest("[data-stop]") && !el.matches(".iconbtn")) return; $("#modal-root").innerHTML = ""; S.armed = null; },
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
  if (ev.key === "Escape" && $("#modal-root")?.innerHTML) { $("#modal-root").innerHTML = ""; }
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.ans) {
    setAnswer(el.dataset.ans, el.value, el.dataset.store, { render: false });
    if (el.type === "date") { const j = $(`#jal-${el.dataset.ans}`); if (j) j.textContent = jalaliLabel(el.value); }
  } else if (el.dataset.row != null && el.dataset.col && el.type !== "checkbox") {
    const i = Number(el.dataset.row), c = el.dataset.col;
    mutate((d) => { d.answers.workRows[i][c] = el.value; }, { render: false });
  }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.unsure) {
    mutate((d) => { const tgt = el.dataset.store === "ids" ? d.ids : d.answers; tgt[el.dataset.unsure + "Unsure"] = el.checked; }, { render: false });
  } else if (el.dataset.col === "present") {
    const i = Number(el.dataset.row);
    mutate((d) => { d.answers.workRows[i].present = el.checked; });
  } else if (el.dataset.check) {
    mutate((d) => { d.checklist[el.dataset.check] = el.checked; }, { log: `${el.checked ? "Ticked" : "Unticked"}: ${T.en["ck_" + el.dataset.check]}` });
  } else if (el.dataset.upload && el.files?.length) {
    addFiles(el.dataset.upload, el.files);
    el.value = "";
  } else if (el.id === "import-file" && el.files?.[0]) {
    importFromClaude(el.files[0]);
    el.value = "";
  } else if (el.dataset.ans && (el.type === "date" || el.type === "month")) {
    renderPanel();
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
    app().innerHTML = `<div class="gate"><div class="card gate-card"><h1 class="display">Nasrin</h1><p class="sub">${esc(t("noVault"))}</p></div></div>`;
    return;
  }
  let msg = "";
  try { msg = sessionStorage.getItem("nasrin.msg") || ""; sessionStorage.removeItem("nasrin.msg"); } catch { /* ignore */ }
  renderLock(msg);
})();
