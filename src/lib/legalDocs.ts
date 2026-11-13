// Hamlaty legal documents (Arabic is the reference text, English is a translation).
// FIRST DRAFTS written from how the platform works. They must be reviewed by a lawyer (Oman, where Hamlaty is run,
// and Iraq, where the hotels are) before launch.

export const LEGAL_UPDATED = "2026-11-13";
export const CONTACT = { support: "support@hamlaty.co", privacy: "privacy@hamlaty.co" };

export interface Clause {
  hAr: string;
  hEn: string;
  ar: string[];
  en: string[];
}
export interface LegalDoc {
  slug: string;
  group: "terms" | "privacy" | "countries";
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  clauses: Clause[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    group: "terms",
    titleAr: "شروط الاستخدام",
    titleEn: "Terms of Use",
    summaryAr: "الشروط التي توافق عليها عند استخدام حملتي.",
    summaryEn: "The terms you agree to when you use Hamlaty.",
    clauses: [
      {
        hAr: "1. من نحن وما الخدمة",
        hEn: "1. Who we are and what the service is",
        ar: [
          "حملتي منصة إلكترونية تربط حملات الزيارة الدينية («الحملات») بالفنادق في كربلاء والنجف والكاظمية وسامراء («الفنادق»).",
          "ترسل الحملة طلب مجموعة، ويرسل كل فندق مؤهل عرضه، ثم تختار الحملة عرضاً ويؤكده الفندق.",
          "حملتي ليست طرفاً في عقد الإقامة بين الحملة والفندق، ولا تقدم خدمة الإقامة أو النقل بنفسها.",
        ],
        en: [
          "Hamlaty is an online platform connecting religious ziyarat campaigns (“Campaigns”) with hotels in Karbala, Najaf, Kadhimiya and Samarra (“Hotels”).",
          "A Campaign sends a group request, each eligible Hotel sends its offer, then the Campaign chooses one and the Hotel confirms it.",
          "Hamlaty is not a party to the accommodation contract between the Campaign and the Hotel, and does not provide accommodation or transport itself.",
        ],
      },
      {
        hAr: "2. الحساب",
        hEn: "2. Your account",
        ar: [
          "تدخل برقم جوالك ورمز يصلك برسالة نصية. أنت مسؤول عن كل ما يتم من رقمك.",
          "يجب أن تكون بيانات الحملة أو الفندق صحيحة، وأن تملك صلاحية التصرف باسمها.",
          "تراجع حملتي كل فندق قبل أن تصله الطلبات، ويحق لها إيقاف أي حساب يخالف هذه الشروط.",
        ],
        en: [
          "You sign in with your mobile number and a code sent by text message. You are responsible for everything done from your number.",
          "Campaign or hotel details must be accurate, and you must be authorised to act for it.",
          "Hamlaty reviews every hotel before requests reach it, and may suspend any account that breaks these terms.",
        ],
      },
      {
        hAr: "3. العروض والحجز",
        hEn: "3. Offers and bookings",
        ar: [
          "تحسب المنصة إجمالي العرض من أسعار الغرف والليالي التي يدخلها الفندق، ولا يمكن تعديل العرض بعد إرساله.",
          "لا تظهر هوية الفندق أو الحملة ولا بيانات التواصل قبل أن يؤكد الفندق الحجز، وتُخفى أرقام الهواتف والروابط في الرسائل حتى ذلك الحين.",
          "الحجز ملزم للطرفين بعد تأكيد الفندق، وتخضع أي تغييرات أو إلغاءات لـ«سياسة الإلغاء».",
        ],
        en: [
          "The platform computes the offer total from the room rates and nights the Hotel enters, and an offer cannot be changed once sent.",
          "Neither the Hotel's nor the Campaign's identity or contact details are shown before the Hotel confirms the booking, and phone numbers and links in messages are hidden until then.",
          "A booking binds both sides once the Hotel confirms it; changes and cancellations follow the Cancellation Policy.",
        ],
      },
      {
        hAr: "4. الرسوم",
        hEn: "4. Fees",
        ar: [
          "استخدام المنصة مجاني للحملات.",
          "يدفع الفندق عمولة على كل حجز مؤكد، بالنسب المبيّنة في «شروط الفنادق».",
        ],
        en: ["Using the platform is free for Campaigns.", "The Hotel pays a commission on each confirmed booking, at the rates set out in the Hotel Terms."],
      },
      {
        hAr: "5. المسؤولية",
        hEn: "5. Liability",
        ar: [
          "تبذل حملتي جهدها للتحقق من الفنادق، لكنها لا تضمن جودة الإقامة أو التزام أي طرف.",
          "لا تتحمل حملتي أي ضرر غير مباشر، وتقتصر مسؤوليتها في جميع الأحوال على العمولة التي تقاضتها عن الحجز المعني.",
          "لا تتحمل حملتي مسؤولية الظروف القاهرة، ومنها الأوضاع الأمنية وإغلاق الحدود أو المطارات وقرارات التأشيرات.",
        ],
        en: [
          "Hamlaty makes efforts to check hotels, but does not guarantee the quality of the stay or any party's performance.",
          "Hamlaty is not liable for indirect loss, and its liability is in any case limited to the commission it received for the booking concerned.",
          "Hamlaty is not liable for force majeure, including security conditions, border or airport closures and visa decisions.",
        ],
      },
      {
        hAr: "6. القانون والنزاعات",
        hEn: "6. Law and disputes",
        ar: ["تخضع هذه الشروط لقوانين سلطنة عُمان، وتختص محاكم مسقط بأي نزاع ما لم يتفق الطرفان على غير ذلك."],
        en: ["These terms are governed by the laws of the Sultanate of Oman, and the courts of Muscat hear any dispute unless the parties agree otherwise."],
      },
    ],
  },
  {
    slug: "hotel-terms",
    group: "terms",
    titleAr: "شروط الفنادق",
    titleEn: "Hotel Terms",
    summaryAr: "العمولة، والتوثيق، والتزامات الفندق.",
    summaryEn: "Commission, verification and the hotel's obligations.",
    clauses: [
      {
        hAr: "1. التوثيق",
        hEn: "1. Verification",
        ar: [
          "يقدّم الفندق بيانات صحيحة عن مدينته ونجومه ومسافته الفعلية إلى الحرم، وتتحقق منها حملتي قبل التفعيل.",
          "تغيير المدينة أو النجوم أو المسافة يعيد الفندق إلى المراجعة.",
        ],
        en: [
          "The Hotel gives accurate details of its city, stars and real distance to the shrine, which Hamlaty checks before activation.",
          "Changing the city, stars or distance sends the Hotel back for review.",
        ],
      },
      {
        hAr: "2. العمولة",
        hEn: "2. Commission",
        ar: [
          "يدفع الفندق عمولة على قيمة كل حجز يؤكده: 5% على أول حجز مع الحملة نفسها، و2% على الحجز الثاني، و1% على كل حجز بعد ذلك.",
          "تُستحق العمولة عند تأكيد الحجز، ولا تُستحق إذا ألغي الحجز وفق سياسة الإلغاء.",
        ],
        en: [
          "The Hotel pays a commission on the value of each booking it confirms: 5% on the first booking with the same Campaign, 2% on the second, and 1% on every later booking.",
          "Commission is due when the booking is confirmed, and is not due if the booking is cancelled under the Cancellation Policy.",
        ],
      },
      {
        hAr: "3. عدم التجاوز",
        hEn: "3. Non-circumvention",
        ar: [
          "إذا تعرّف الفندق على حملة عبر حملتي، فأي حجز مباشر معها خارج المنصة خلال 24 شهراً من أول حجز تستحق عنه حملتي العمولة نفسها.",
          "يحق لحملتي إيقاف الفندق الذي يثبت تجاوزه للمنصة.",
        ],
        en: [
          "If the Hotel came to know a Campaign through Hamlaty, Hamlaty is owed the same commission on any direct booking with that Campaign outside the platform within 24 months of the first booking.",
          "Hamlaty may suspend a Hotel shown to have bypassed the platform.",
        ],
      },
      {
        hAr: "4. الالتزام بالحجز",
        hEn: "4. Honouring bookings",
        ar: [
          "يلتزم الفندق بالغرف والأسعار والوجبات في العرض المؤكد، ولا يبيع الغرف المحجوزة لغير الحملة.",
          "عند الإخلال، يحق لحملتي إيقاف الفندق ونشر ذلك في تقييماته.",
        ],
        en: [
          "The Hotel honours the rooms, rates and meals in the confirmed offer, and does not sell the booked rooms to anyone else.",
          "On breach, Hamlaty may suspend the Hotel and reflect it in its ratings.",
        ],
      },
    ],
  },
  {
    slug: "cancellations",
    group: "terms",
    titleAr: "سياسة الإلغاء",
    titleEn: "Cancellation Policy",
    summaryAr: "ماذا يحدث عند إلغاء حجز.",
    summaryEn: "What happens when a booking is cancelled.",
    clauses: [
      {
        hAr: "1. الإلغاء من المنصة",
        hEn: "1. Cancelling on the platform",
        ar: [
          "يستطيع أي طرف إلغاء الحجز من المنصة قبل موعد الوصول، ويُعاد فتح طلب الحملة لتختار فندقاً آخر.",
          "تُطبّق شروط الإلغاء المكتوبة في عرض الفندق، إن وجدت، بين الطرفين مباشرة.",
        ],
        en: [
          "Either side can cancel the booking on the platform before arrival, and the Campaign's request reopens so it can choose another hotel.",
          "Any cancellation terms written in the Hotel's offer apply between the two sides directly.",
        ],
      },
      {
        hAr: "2. الظروف القاهرة",
        hEn: "2. Force majeure",
        ar: ["عند إغلاق الحدود أو المطارات أو صدور قرار رسمي يمنع السفر، يُلغى الحجز دون عمولة على الفندق."],
        en: ["If borders or airports close or an official decision prevents travel, the booking is cancelled with no commission charged to the Hotel."],
      },
    ],
  },
  {
    slug: "privacy",
    group: "privacy",
    titleAr: "سياسة الخصوصية",
    titleEn: "Privacy Policy",
    summaryAr: "كيف نتعامل مع بياناتك الشخصية وبيانات الزوار.",
    summaryEn: "How we handle your personal data and pilgrims' data.",
    clauses: [
      {
        hAr: "1. البيانات التي نجمعها",
        hEn: "1. Data we collect",
        ar: [
          "رقم الجوال للدخول، واسم الحملة أو الفندق وبياناته، وطلبات المجموعات والعروض والرسائل.",
          "بيانات الزوار التي تدخلها الحملة أو يسجلها الزائر بنفسه: الاسم، والجوال، والجنس، وسنة الميلاد، والجنسية، ورقم الجواز، ورقم الطوارئ.",
        ],
        en: [
          "Your mobile number for sign-in, the campaign or hotel details, and group requests, offers and messages.",
          "Pilgrim details entered by the campaign or by the pilgrim: name, mobile, gender, birth year, nationality, passport number and emergency contact.",
        ],
      },
      {
        hAr: "2. لماذا نستخدمها",
        hEn: "2. Why we use it",
        ar: [
          "لتشغيل الطلبات والعروض والحجوزات وإرسال الإشعارات.",
          "بيانات الزوار تراها الحملة المنظمة فقط، ولا تظهر للفنادق ولا لغيرها، ولا نبيعها لأي جهة.",
        ],
        en: [
          "To run requests, offers and bookings and to send notifications.",
          "Pilgrim details are visible only to the organising campaign, never to hotels or anyone else, and we never sell them.",
        ],
      },
      {
        hAr: "3. أين تُحفظ",
        hEn: "3. Where it is stored",
        ar: ["تُحفظ البيانات لدى مزودي خدمات سحابية قد تكون خوادمهم خارج دولتك، بحماية وتشفير، وتوافق على ذلك عند التسجيل."],
        en: ["Data is stored with cloud providers whose servers may be outside your country, protected and encrypted, which you agree to when signing up."],
      },
      {
        hAr: "4. حقوقك",
        hEn: "4. Your rights",
        ar: ["يحق لك طلب نسخة من بياناتك أو تصحيحها أو حذفها عبر البريد المذكور أدناه."],
        en: ["You may ask for a copy of your data, its correction or its deletion at the email below."],
      },
    ],
  },
  {
    slug: "countries",
    group: "countries",
    titleAr: "الدول والعملة",
    titleEn: "Countries and currency",
    summaryAr: "دول الحملات، والعراق، والعملة.",
    summaryEn: "Campaign countries, Iraq and currency.",
    clauses: [
      {
        hAr: "1. أين نعمل",
        hEn: "1. Where we operate",
        ar: [
          "تُدار حملتي من سلطنة عُمان، وتخدم حملات من عُمان ودول الخليج ولبنان والعراق.",
          "الفنادق في جمهورية العراق، وتخضع إقامة الزوار لأنظمتها، ومنها التأشيرات.",
        ],
        en: [
          "Hamlaty is run from the Sultanate of Oman and serves campaigns from Oman, the Gulf states, Lebanon and Iraq.",
          "Hotels are in the Republic of Iraq, and pilgrims' stays follow its rules, including visas.",
        ],
      },
      {
        hAr: "2. العملة",
        hEn: "2. Currency",
        ar: ["تُعرض الأسعار بالدولار الأمريكي أو الدينار العراقي حسب عرض الفندق. الدفع حالياً يتم بين الحملة والفندق مباشرة."],
        en: ["Prices are shown in US dollars or Iraqi dinars, as the Hotel's offer states. Payment currently takes place directly between the Campaign and the Hotel."],
      },
    ],
  },
];

export const docBySlug = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);
