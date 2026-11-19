// Hamlaty legal documents (Arabic is the reference text, English is a translation).
// FIRST DRAFTS written from how the platform works. They must be reviewed by a lawyer (Oman, where Hamlaty is run,
// and Iraq, where the hotels are) before launch.

export const LEGAL_UPDATED = "2026-11-20";
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
          "حملتي منصة إلكترونية تربط حملات الزيارة الدينية («الحملات») بالفنادق في كربلاء والنجف والكاظمية وسامراء («الفنادق») وبمكاتب حجوزات الطيران («المكاتب»)، ويُسمّى الفندق والمكتب معاً «مقدّم الخدمة».",
          "ترسل الحملة طلب مجموعة، ويرسل كل مقدّم خدمة مؤهل عرضه، ثم تختار الحملة عرضاً ويؤكده مقدّم الخدمة.",
          "حملتي ليست طرفاً في عقد الإقامة أو النقل بين الحملة ومقدّم الخدمة، ولا تقدم خدمة الإقامة أو الطيران بنفسها.",
        ],
        en: [
          "Hamlaty is an online platform connecting religious ziyarat campaigns (“Campaigns”) with hotels in Karbala, Najaf, Kadhimiya and Samarra (“Hotels”) and flight booking offices (“Offices”); a Hotel or Office is a “Provider”.",
          "A Campaign sends a group request, each eligible Provider sends its offer, then the Campaign chooses one and the Provider confirms it.",
          "Hamlaty is not a party to the accommodation or travel contract between the Campaign and the Provider, and does not provide accommodation or flights itself.",
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
          "تحسب المنصة إجمالي العرض من أسعار الغرف أو المقاعد التي يدخلها مقدّم الخدمة، ولا يمكن تعديل العرض بعد إرساله.",
          "يصبح الحجز مؤكداً بعد أن يؤكده مقدّم الخدمة ويُدفع عربون التأكيد عبر حملتي. قبل ذلك لا تظهر هوية أي طرف ولا بيانات التواصل، وتُخفى أرقام الهواتف والروابط في الرسائل.",
          "الحجز المؤكد ملزم للطرفين، وتخضع أي تغييرات أو إلغاءات لـ«سياسة الإلغاء».",
        ],
        en: [
          "The platform computes the offer total from the room or seat prices the Provider enters, and an offer cannot be changed once sent.",
          "A booking is confirmed once the Provider confirms it and the confirmation deposit is paid through Hamlaty. Until then neither side's identity or contact details are shown, and phone numbers and links in messages are hidden.",
          "A confirmed booking binds both sides; changes and cancellations follow the Cancellation Policy.",
        ],
      },
      {
        hAr: "4. الرسوم",
        hEn: "4. Fees",
        ar: [
          "استخدام المنصة مجاني للحملات، ولا تتحمل الحملة أي رسوم. التسجيل وإرسال العروض مجاني لمقدّمي الخدمة، ولا يُدفع أي مبلغ مقدماً.",
          "عند تأكيد مقدّم الخدمة للحجز، تدفع الحملة «عربون التأكيد» عبر حملتي، وهو جزء من سعر الحجز يُخصم من المبلغ المستحق لمقدّم الخدمة، فلا تدفع الحملة أي مبلغ إضافي.",
          "رسوم مقدّمي الخدمة لحملتي مبيّنة في «شروط الفنادق» و«شروط مكاتب الطيران»، ويتحملها مقدّم الخدمة من سعره.",
        ],
        en: [
          "Using the platform is free for Campaigns, which bear no fees. Joining and sending offers are free for Providers, and nothing is paid in advance.",
          "Once the Provider confirms a booking, the Campaign pays the “confirmation deposit” through Hamlaty. It is part of the booking price and is deducted from the amount owed to the Provider, so the Campaign pays nothing extra.",
          "Providers' fees to Hamlaty are set out in the Hotel Terms and the Flight Office Terms, and are borne by the Provider out of its price.",
        ],
      },
      {
        hAr: "5. المسؤولية",
        hEn: "5. Liability",
        ar: [
          "تبذل حملتي جهدها للتحقق من الفنادق، لكنها لا تضمن جودة الإقامة أو التزام أي طرف.",
          "لا تتحمل حملتي أي ضرر غير مباشر، وتقتصر مسؤوليتها في جميع الأحوال على الرسوم التي تقاضتها عن الحجز المعني.",
          "لا تتحمل حملتي مسؤولية الظروف القاهرة، ومنها الأوضاع الأمنية وإغلاق الحدود أو المطارات وقرارات التأشيرات.",
        ],
        en: [
          "Hamlaty makes efforts to check hotels, but does not guarantee the quality of the stay or any party's performance.",
          "Hamlaty is not liable for indirect loss, and its liability is in any case limited to the fee it received for the booking concerned.",
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
    summaryAr: "الرسوم، والتوثيق، والتزامات الفندق.",
    summaryEn: "Fees, verification and the hotel's obligations.",
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
        hAr: "2. الرسوم",
        hEn: "2. Fees",
        ar: [
          "التسجيل وإرسال العروض مجاني، ولا يدفع الفندق أي مبلغ مقدماً.",
          "رسوم حملتي دولار أمريكي واحد عن كل زائر في الحجز، يتحملها الفندق من سعره. تدفعها الحملة لحملتي «عربونَ تأكيد»، ويخصمها الفندق من المبلغ المستحق له على الحملة.",
          "لا يُعتبر الحجز مؤكداً، ولا تظهر بيانات الحملة، قبل دفع عربون التأكيد.",
        ],
        en: [
          "Joining and sending offers are free, and the Hotel pays nothing in advance.",
          "Hamlaty's fee is one US dollar per pilgrim in the booking, borne by the Hotel out of its price. The Campaign pays it to Hamlaty as a “confirmation deposit”, and the Hotel deducts it from the amount the Campaign owes it.",
          "A booking is not confirmed, and the Campaign's details are not shown, until the confirmation deposit is paid.",
        ],
      },
      {
        hAr: "3. عدم التجاوز",
        hEn: "3. Non-circumvention",
        ar: [
          "إذا تعرّف الفندق على حملة عبر حملتي، فأي حجز مباشر معها خارج المنصة خلال 24 شهراً من أول حجز تستحق عنه حملتي الرسوم نفسها.",
          "يحق لحملتي إيقاف الفندق الذي يثبت تجاوزه للمنصة.",
        ],
        en: [
          "If the Hotel came to know a Campaign through Hamlaty, Hamlaty is owed the same fee on any direct booking with that Campaign outside the platform within 24 months of the first booking.",
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
    slug: "office-terms",
    group: "terms",
    titleAr: "شروط مكاتب الطيران",
    titleEn: "Flight Office Terms",
    summaryAr: "الرسوم، والتوثيق، والتزامات مكتب حجوزات الطيران.",
    summaryEn: "Fees, verification and the flight booking office's obligations.",
    clauses: [
      {
        hAr: "1. التوثيق",
        hEn: "1. Verification",
        ar: ["يقدّم المكتب ترخيصاً سارياً لبيع تذاكر الطيران، وتتحقق منه حملتي قبل التفعيل. تغيير رقم الترخيص يعيد المكتب إلى المراجعة."],
        en: ["The Office provides a valid licence to sell air tickets, which Hamlaty checks before activation. Changing the licence number sends the Office back for review."],
      },
      {
        hAr: "2. الرسوم",
        hEn: "2. Fees",
        ar: [
          "التسجيل وإرسال العروض مجاني، ولا يدفع المكتب أي مبلغ مقدماً.",
          "رسوم حملتي ثلاثة دولارات أمريكية عن كل تذكرة في الحجز، وتذكرة الذهاب والعودة تذكرة واحدة، يتحملها المكتب من سعره. تدفعها الحملة لحملتي «عربونَ تأكيد»، ويخصمها المكتب من المبلغ المستحق له على الحملة.",
          "لا يُعتبر الحجز مؤكداً، ولا تظهر بيانات الحملة، قبل دفع عربون التأكيد.",
        ],
        en: [
          "Joining and sending offers are free, and the Office pays nothing in advance.",
          "Hamlaty's fee is three US dollars per ticket in the booking, a return ticket counting as one, borne by the Office out of its price. The Campaign pays it to Hamlaty as a “confirmation deposit”, and the Office deducts it from the amount the Campaign owes it.",
          "A booking is not confirmed, and the Campaign's details are not shown, until the confirmation deposit is paid.",
        ],
      },
      {
        hAr: "3. عدم التجاوز",
        hEn: "3. Non-circumvention",
        ar: ["إذا تعرّف المكتب على حملة عبر حملتي، فأي حجز مباشر معها خارج المنصة خلال 24 شهراً من أول حجز تستحق عنه حملتي الرسوم نفسها."],
        en: ["If the Office came to know a Campaign through Hamlaty, Hamlaty is owed the same fee on any direct booking with that Campaign outside the platform within 24 months of the first booking."],
      },
      {
        hAr: "4. الالتزام بالحجز",
        hEn: "4. Honouring bookings",
        ar: [
          "يلتزم المكتب بالمقاعد والأسعار والمواعيد في العرض المؤكد، ويحجز المقاعد حتى تاريخ صلاحية العرض.",
          "إذا غيّرت شركة الطيران مواعيدها، يبلغ المكتب الحملة ويوفّر البديل.",
        ],
        en: [
          "The Office honours the seats, fares and times in the confirmed offer, and holds the seats until the offer's expiry.",
          "If the airline changes its schedule, the Office informs the Campaign and finds an alternative.",
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
          "يستطيع أي طرف إلغاء الحجز من المنصة قبل موعد الوصول أو السفر، ويُعاد فتح طلب الحملة لتختار مقدّم خدمة آخر.",
          "تُطبّق شروط الإلغاء المكتوبة في عرض مقدّم الخدمة، وشروط شركة الطيران، بين الطرفين مباشرة.",
          "عربون التأكيد المدفوع عبر حملتي يُحتسب من سعر الحجز. إذا ألغى مقدّم الخدمة الحجز، أو تعذّر تنفيذه لظرف قاهر، يُعاد إلى الحملة.",
        ],
        en: [
          "Either side can cancel the booking on the platform before arrival or travel, and the Campaign's request reopens so it can choose another Provider.",
          "Any cancellation terms written in the Provider's offer, and the airline's fare rules, apply between the two sides directly.",
          "The confirmation deposit paid through Hamlaty counts towards the booking price. If the Provider cancels the booking, or force majeure prevents it, it is returned to the Campaign.",
        ],
      },
      {
        hAr: "2. الظروف القاهرة",
        hEn: "2. Force majeure",
        ar: ["عند إغلاق الحدود أو المطارات أو صدور قرار رسمي يمنع السفر، يُلغى الحجز ويُعاد عربون التأكيد إلى الحملة."],
        en: ["If borders or airports close or an official decision prevents travel, the booking is cancelled and the confirmation deposit is returned to the Campaign."],
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
          "بيانات الزوار تراها الحملة المنظمة فقط، ولا تظهر للفنادق ولا لمكاتب الطيران ولا لغيرها، ولا نبيعها لأي جهة.",
        ],
        en: [
          "To run requests, offers and bookings and to send notifications.",
          "Pilgrim details are visible only to the organising campaign, never to hotels, flight offices or anyone else, and we never sell them.",
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
        ar: ["تُعرض الأسعار بعملة عرض مقدّم الخدمة. عربون التأكيد عبر حملتي بالدولار الأمريكي، وباقي السعر يُدفع بين الحملة ومقدّم الخدمة مباشرة."],
        en: ["Prices are shown in the currency of the Provider's offer. The confirmation deposit through Hamlaty is in US dollars; the rest of the price is paid between the Campaign and the Provider directly."],
      },
    ],
  },
];

export const docBySlug = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);
