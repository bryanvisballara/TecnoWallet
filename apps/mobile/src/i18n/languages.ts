export type Locale = 'es' | 'en' | 'zh' | 'hi' | 'ar';

export const languages: Array<{
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
}> = [
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
];

type OnboardingCopy = {
  skip: string;
  continue: string;
  start: string;
  language: string;
  slides: Array<{ title: string; text: string }>;
};

export const onboardingCopy: Record<Locale, OnboardingCopy> = {
  es: {
    skip: 'Omitir',
    continue: 'Continuar',
    start: 'Empezar',
    language: 'Idioma',
    slides: [
      {
        title: 'Todo tu dinero,\nen un solo lugar',
        text: 'Cuentas, gastos, metas y presupuestos claros. Sin hojas de cálculo.',
      },
      {
        title: 'Decisiones más\ninteligentes',
        text: 'Recibe análisis útiles y una guía diaria basada en tus hábitos.',
      },
      {
        title: 'Privado por diseño',
        text: 'Tus credenciales se cifran en el dispositivo y tú controlas tus datos.',
      },
    ],
  },
  en: {
    skip: 'Skip',
    continue: 'Continue',
    start: 'Get started',
    language: 'Language',
    slides: [
      {
        title: 'All your money,\nin one place',
        text: 'Clear accounts, spending, goals, and budgets. No spreadsheets.',
      },
      {
        title: 'Smarter money\ndecisions',
        text: 'Get useful insights and daily guidance based on your habits.',
      },
      {
        title: 'Private by design',
        text: 'Your credentials stay encrypted on device and you stay in control.',
      },
    ],
  },
  zh: {
    skip: '跳过',
    continue: '继续',
    start: '开始',
    language: '语言',
    slides: [
      {
        title: '你的全部资金\n尽在一处',
        text: '账户、支出、目标和预算一目了然。无需电子表格。',
      },
      {
        title: '更明智的\n理财决策',
        text: '根据你的习惯，获得实用分析和每日建议。',
      },
      {
        title: '天生注重',
        text: '凭证在设备上加密，数据完全由你掌控。',
      },
    ],
  },
  hi: {
    skip: 'छोड़ें',
    continue: 'आगे बढ़ें',
    start: 'शुरू करें',
    language: 'भाषा',
    slides: [
      {
        title: 'आपका सारा पैसा\nएक ही जगह',
        text: 'खाते, खर्च, लक्ष्य और बजट साफ़-साफ़। बिना स्प्रेडशीट के।',
      },
      {
        title: 'समझदार\nफैसले',
        text: 'अपनी आदतों के आधार पर उपयोगी विश्लेषण और दैनिक मार्गदर्शन पाएं।',
      },
      {
        title: 'निजी डिज़ाइन',
        text: 'आपकी जानकारी डिवाइस पर सुरक्षित रहती है और नियंत्रण आपके पास रहता है।',
      },
    ],
  },
  ar: {
    skip: 'تخطي',
    continue: 'متابعة',
    start: 'ابدأ',
    language: 'اللغة',
    slides: [
      {
        title: 'كل أموالك\nفي مكان واحد',
        text: 'حسابات ومصروفات وأهداف وميزانيات واضحة. بلا جداول معقدة.',
      },
      {
        title: 'قرارات مالية\nأذكى',
        text: 'احصل على تحليلات مفيدة وإرشاد يومي مبني على عاداتك.',
      },
      {
        title: 'خصوصية بالتصميم',
        text: 'بياناتك تُشفَّر على جهازك وتبقى تحت سيطرتك.',
      },
    ],
  },
};

type AuthCopy = {
  language: string;
  welcomeTitle: string;
  registerTitle: string;
  subtitle: string;
  email: string;
  password: string;
  name: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  namePlaceholder: string;
  signIn: string;
  signUp: string;
  signingIn: string;
  creating: string;
  forgot: string;
  or: string;
  google: string;
  demo: string;
  noAccount: string;
  hasAccount: string;
  registerLink: string;
  signInLink: string;
  legal: string;
  invalid: string;
  genericError: string;
};

export const authCopy: Record<Locale, AuthCopy> = {
  es: {
    language: 'Idioma',
    welcomeTitle: 'Qué bueno verte',
    registerTitle: 'Crea tu cuenta',
    subtitle: 'Tu dinero, tu futuro, tu control.',
    email: 'Correo electrónico',
    password: 'Contraseña',
    name: 'Nombre',
    emailPlaceholder: 'tu@correo.com',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    namePlaceholder: 'Tu nombre',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarme',
    signingIn: 'Entrando…',
    creating: 'Creando cuenta…',
    forgot: '¿Olvidaste tu contraseña?',
    or: 'o',
    google: 'Inicia sesión con Google',
    demo: 'Explorar con datos demo',
    noAccount: '¿Aún no tienes cuenta?',
    hasAccount: '¿Ya tienes cuenta?',
    registerLink: 'Regístrate',
    signInLink: 'Inicia sesión',
    legal: 'Al continuar aceptas los Términos y la Política de privacidad.',
    invalid: 'Revisa tu correo y contraseña.',
    genericError: 'No pudimos completar la solicitud.',
  },
  en: {
    language: 'Language',
    welcomeTitle: 'Welcome back',
    registerTitle: 'Create your account',
    subtitle: 'Your money, your future, your control.',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: 'At least 6 characters',
    namePlaceholder: 'Your name',
    signIn: 'Sign in',
    signUp: 'Sign up',
    signingIn: 'Signing in…',
    creating: 'Creating account…',
    forgot: 'Forgot your password?',
    or: 'or',
    google: 'Sign in with Google',
    demo: 'Explore with demo data',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    registerLink: 'Sign up',
    signInLink: 'Sign in',
    legal: 'By continuing you accept the Terms and Privacy Policy.',
    invalid: 'Check your email and password.',
    genericError: 'We could not complete the request.',
  },
  zh: {
    language: '语言',
    welcomeTitle: '欢迎回来',
    registerTitle: '创建账户',
    subtitle: '你的金钱，你的未来，你的掌控。',
    email: '电子邮箱',
    password: '密码',
    name: '姓名',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: '至少 6 个字符',
    namePlaceholder: '你的名字',
    signIn: '登录',
    signUp: '注册',
    signingIn: '登录中…',
    creating: '创建中…',
    forgot: '忘记密码？',
    or: '或',
    google: '使用 Google 登录',
    demo: '使用演示数据体验',
    noAccount: '还没有账户？',
    hasAccount: '已有账户？',
    registerLink: '注册',
    signInLink: '登录',
    legal: '继续即表示你同意条款与隐私政策。',
    invalid: '请检查邮箱和密码。',
    genericError: '无法完成请求。',
  },
  hi: {
    language: 'भाषा',
    welcomeTitle: 'वापसी पर स्वागत है',
    registerTitle: 'अपना खाता बनाएं',
    subtitle: 'आपका पैसा, आपका भविष्य, आपका नियंत्रण।',
    email: 'ईमेल',
    password: 'पासवर्ड',
    name: 'नाम',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: 'कम से कम 6 अक्षर',
    namePlaceholder: 'आपका नाम',
    signIn: 'साइन इन',
    signUp: 'रजिस्टर करें',
    signingIn: 'साइन इन हो रहा है…',
    creating: 'खाता बन रहा है…',
    forgot: 'पासवर्ड भूल गए?',
    or: 'या',
    google: 'Google से साइन इन करें',
    demo: 'डेमो डेटा से देखें',
    noAccount: 'अभी खाता नहीं है?',
    hasAccount: 'पहले से खाता है?',
    registerLink: 'रजिस्टर करें',
    signInLink: 'साइन इन',
    legal: 'जारी रखकर आप नियम और गोपनीयता नीति स्वीकार करते हैं।',
    invalid: 'अपना ईमेल और पासवर्ड जांचें।',
    genericError: 'अनुरोध पूरा नहीं हो सका।',
  },
  ar: {
    language: 'اللغة',
    welcomeTitle: 'مرحباً بعودتك',
    registerTitle: 'أنشئ حسابك',
    subtitle: 'مالك، مستقبلك، سيطرتك.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    name: 'الاسم',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: '6 أحرف على الأقل',
    namePlaceholder: 'اسمك',
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    signingIn: 'جارٍ الدخول…',
    creating: 'جارٍ إنشاء الحساب…',
    forgot: 'هل نسيت كلمة المرور؟',
    or: 'أو',
    google: 'تسجيل الدخول عبر Google',
    demo: 'استكشف ببيانات تجريبية',
    noAccount: 'ليس لديك حساب بعد؟',
    hasAccount: 'هل لديك حساب بالفعل؟',
    registerLink: 'سجّل الآن',
    signInLink: 'سجّل الدخول',
    legal: 'بالمتابعة فإنك توافق على الشروط وسياسة الخصوصية.',
    invalid: 'تحقق من بريدك وكلمة المرور.',
    genericError: 'تعذر إكمال الطلب.',
  },
};
