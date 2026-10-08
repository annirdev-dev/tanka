export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

// Contact/entity placeholders — fill these in with your real details before publishing.
const CONTACT_EMAIL = "annirdev@gmail.com";
const ENTITY_NAME = "Annir Dev";

export const privacyPolicy: { pt: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: October 2026",
    sections: [
      {
        heading: "Overview",
        body: `Tanka ("the app") helps you find and compare fuel prices at gas stations in Portugal. This policy explains what data the app collects, why, and how it's handled. The app is operated by ${ENTITY_NAME}.`,
      },
      {
        heading: "Location data",
        body: "The app uses your device location to show fuel stations near you. Your coordinates are sent to our backend (hosted by Supabase in the EU) only to find nearby stations in our own price database; we don't store them with your account or share them with anyone. Our hosting provider may keep routine technical request logs for a limited time. If you use \"On My Way\" to search along a route, your start and destination coordinates are also sent to Google's Routes API to calculate the driving route; routes are cached for up to a day without your name or account. If you decline location access, or you are outside Portugal, the app shows stations in Lisbon instead. You can change location access at any time in your device Settings.",
      },
      {
        heading: "Data stored on your device",
        body: "Your favorite stations, price alerts, and app preferences (fuel type, theme, language) are stored locally on your device. This data is not sent anywhere unless you choose to sign in (see below).",
      },
      {
        heading: "Account & sync (optional)",
        body: "If you choose to sign in with Apple or Google, we receive your name and email address (or a private relay address, if you use Apple's \"Hide My Email\") from that provider, solely to identify your account. We then store the following with Supabase, our backend infrastructure provider (authentication and database hosting): your account, your favorites and price alerts, your notification token, the start date of your free trial, and whether Tanka Pro is active on your account. Supabase processes this data only on our behalf and does not use it for its own purposes. We never receive or store your Apple or Google password. You can delete your account and all synced data at any time from Settings; deleting it also removes the link between Tanka and your Apple ID.",
      },
      {
        heading: "Purchases and free trial",
        body: "Tanka Pro is a one-time in-app purchase handled entirely by Apple (on iPhone) or Google Play (on Android) — we never see your payment details. To unlock Pro on your account, our server asks the store to confirm your purchase (it sends Apple the purchase's transaction ID, or Google Play the purchase token) and stores that Pro is active together with that ID or token. If the store tells us the purchase was refunded, Pro is switched off for it. Signed-in accounts get a free 5-day trial of the Pro features.",
      },
      {
        heading: "Keeping the free trial fair",
        body: "To stop the free trial being repeated by deleting and re-creating an account, when you delete your account we keep a one-way code (a hash) derived from your Apple or Google sign-in identifier, together with your trial start date. It cannot be used to identify or contact you, and it is used only to prevent this kind of abuse (our legitimate interest).",
      },
      {
        heading: "Notifications",
        body: "If you set a price alert, we store a device push token (via the Expo push notification service, which uses Apple's push service on iPhone and Google's Firebase Cloud Messaging on Android) so we can check prices periodically on our server and notify you even while the app is closed. We can't see or read the content of push notifications sent to other apps, and this token is only ever used to deliver your own price alerts.",
      },
      {
        heading: "How long we keep data",
        body: "Account data is kept until you delete your account. Notification tokens are removed when they stop working. Routine hosting logs are kept by our providers for a limited time. The one-way trial code described above is kept so the free trial can't be repeated.",
      },
      {
        heading: "What we don't do",
        body: "We don't show ads, use analytics or tracking SDKs, or sell or share your data with advertisers or data brokers. The only third parties involved are: API Aberta (fuel price data — no personal data is sent to it); Google (Routes API for \"On My Way\", Sign in with Google if you choose it, and, on Android, Google Play for purchases and Firebase Cloud Messaging for notifications); Apple (Sign in with Apple, purchases and Apple Maps); Supabase (backend hosting for accounts and data, in the EU); and Expo (delivering push notifications and app updates).",
      },
      {
        heading: "Your rights",
        body: "You can clear your favorites and price alerts at any time from Settings. If you have an account, you can request deletion of your account and all associated data from Settings, or by contacting us. If you are in the EU/EEA, you have rights under the GDPR including access, correction, and erasure of your data.",
      },
      {
        heading: "Changes to this policy",
        body: "We may update this policy from time to time. Material changes will be reflected by updating the date above.",
      },
      {
        heading: "Contact",
        body: `Questions about this policy? Contact ${CONTACT_EMAIL}.`,
      },
    ],
  },
  pt: {
    title: "Política de Privacidade",
    updated: "Última atualização: outubro de 2026",
    sections: [
      {
        heading: "Visão geral",
        body: `O Tanka („a app") ajuda-te a encontrar e comparar preços de combustível em postos de abastecimento em Portugal. Esta política explica que dados a app recolhe, porquê, e como são tratados. A app é operada por ${ENTITY_NAME}.`,
      },
      {
        heading: "Dados de localização",
        body: "A app usa a localização do teu dispositivo para mostrar os postos perto de ti. As tuas coordenadas são enviadas para o nosso backend (alojado na Supabase, na UE) apenas para encontrar postos próximos na nossa própria base de preços; não as guardamos associadas à tua conta nem as partilhamos com ninguém. O nosso fornecedor de alojamento pode manter registos técnicos de pedidos durante um período limitado. Se usares „A caminho\" para pesquisar ao longo de uma rota, as coordenadas de partida e destino são também enviadas para a API Routes da Google para calcular o trajeto; os trajetos ficam em cache até um dia, sem o teu nome nem conta. Se recusares o acesso à localização, ou estiveres fora de Portugal, a app mostra os postos de Lisboa. Podes alterar o acesso à localização a qualquer momento nas definições do teu dispositivo.",
      },
      {
        heading: "Dados guardados no teu dispositivo",
        body: "Os teus postos favoritos, alertas de preço e preferências da app (tipo de combustível, tema, idioma) são guardados localmente no teu dispositivo. Estes dados não são enviados para lado nenhum, a menos que optes por iniciar sessão (ver abaixo).",
      },
      {
        heading: "Conta e sincronização (opcional)",
        body: "Se optares por iniciar sessão com a Apple ou a Google, recebemos o teu nome e endereço de email (ou um endereço de reencaminhamento privado, caso uses o „Ocultar o Meu Email\" da Apple) desse fornecedor, exclusivamente para identificar a tua conta. Guardamos depois na Supabase, o nosso fornecedor de infraestrutura de backend (autenticação e alojamento de base de dados): a tua conta, os teus favoritos e alertas de preço, o teu token de notificações, a data de início do teu período experimental e se o Tanka Pro está ativo na tua conta. A Supabase processa estes dados apenas em nosso nome e não os utiliza para fins próprios. Nunca recebemos nem armazenamos a tua palavra-passe da Apple ou da Google. Podes eliminar a tua conta e todos os dados sincronizados a qualquer momento a partir das Definições; ao eliminá-la, removemos também a ligação entre o Tanka e o teu ID Apple.",
      },
      {
        heading: "Compras e período experimental",
        body: "O Tanka Pro é uma compra única na app, tratada inteiramente pela Apple (no iPhone) ou pelo Google Play (no Android) — nunca vemos os teus dados de pagamento. Para desbloquear o Pro na tua conta, o nosso servidor pede à loja que confirme a tua compra (envia à Apple o ID da transação, ou ao Google Play o token de compra) e guarda que o Pro está ativo, juntamente com esse ID ou token. Se a loja nos informar que a compra foi reembolsada, o Pro é desativado. As contas com sessão iniciada têm um período experimental gratuito de 5 dias das funcionalidades Pro.",
      },
      {
        heading: "Manter o período experimental justo",
        body: "Para evitar que o período experimental seja repetido eliminando e recriando uma conta, quando eliminas a tua conta guardamos um código irreversível (um hash) derivado do identificador do teu início de sessão com a Apple ou a Google, juntamente com a data de início do período experimental. Esse código não permite identificar-te nem contactar-te e só é usado para evitar este tipo de abuso (o nosso interesse legítimo).",
      },
      {
        heading: "Notificações",
        body: "Se configurares um alerta de preço, guardamos um token de notificações push do dispositivo (através do serviço de notificações push da Expo, que usa o serviço push da Apple no iPhone e o Firebase Cloud Messaging da Google no Android) para podermos verificar os preços periodicamente no nosso servidor e notificar-te mesmo com a app fechada. Não conseguimos ver nem aceder ao conteúdo de notificações push enviadas para outras apps, e este token só é usado para entregar os teus próprios alertas de preço.",
      },
      {
        heading: "Durante quanto tempo guardamos os dados",
        body: "Os dados da conta são guardados até eliminares a tua conta. Os tokens de notificações são removidos quando deixam de funcionar. Os registos técnicos de alojamento são mantidos pelos nossos fornecedores durante um período limitado. O código irreversível do período experimental, descrito acima, é guardado para que o período experimental não possa ser repetido.",
      },
      {
        heading: "O que não fazemos",
        body: "Não mostramos anúncios, não usamos SDKs de análise ou rastreio, nem vendemos ou partilhamos os teus dados com anunciantes ou corretores de dados. Os únicos terceiros envolvidos são: a API Aberta (dados de preços de combustível — não lhe é enviado qualquer dado pessoal); a Google (API Routes para „A caminho\", início de sessão com a Google se o escolheres e, no Android, Google Play para compras e Firebase Cloud Messaging para notificações); a Apple (início de sessão com a Apple, compras e Apple Maps); a Supabase (alojamento do backend para contas e dados, na UE); e a Expo (entrega de notificações push e atualizações da app).",
      },
      {
        heading: "Os teus direitos",
        body: "Podes limpar os teus favoritos e alertas de preço a qualquer momento a partir das Definições. Se tiveres uma conta, podes pedir a eliminação da tua conta e de todos os dados associados a partir das Definições, ou contactando-nos. Se estiveres na UE/EEE, tens direitos ao abrigo do RGPD, incluindo acesso, retificação e eliminação dos teus dados.",
      },
      {
        heading: "Alterações a esta política",
        body: "Podemos atualizar esta política periodicamente. Alterações relevantes serão refletidas atualizando a data acima.",
      },
      {
        heading: "Contacto",
        body: `Tens dúvidas sobre esta política? Contacta ${CONTACT_EMAIL}.`,
      },
    ],
  },
};

export const terms: { pt: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Terms of Use",
    updated: "Last updated: October 2026",
    sections: [
      {
        heading: "Acceptance",
        body: `By using Tanka ("the app"), you agree to these terms. If you don't agree, please don't use the app. The app is operated by ${ENTITY_NAME}.`,
      },
      {
        heading: "What the app is",
        body: "Tanka shows fuel prices at gas stations in Portugal, sourced from the API Aberta service, for informational purposes. Prices are reported near real-time but may occasionally be delayed, missing, or inaccurate. Always confirm the price at the pump before fueling — the app is not a substitute for that.",
      },
      {
        heading: "Accounts",
        body: "If you sign in, you're responsible for keeping your account secure and for all activity under it. You may request deletion of your account at any time. We may suspend or terminate accounts that abuse the service.",
      },
      {
        heading: "Tanka Pro and free trial",
        body: "Tanka Pro is a one-time purchase made through the App Store (iPhone) or Google Play (Android) and is tied to your Apple ID or Google account and, when you are signed in, to your Tanka account. Payment, receipts and refunds are handled by Apple or Google under their own terms; if a purchase is refunded, Pro is switched off. Signed-in accounts get a free 5-day trial, once per person. Features and prices may change for future purchases.",
      },
      {
        heading: "Acceptable use",
        body: "Don't use the app to scrape, resell, or redistribute the underlying price data in bulk, attempt to bypass rate limits, reverse-engineer the backend, or otherwise interfere with the service or API Aberta's API in ways that violate API Aberta's own terms of use.",
      },
      {
        heading: "No warranty",
        body: 'The app and its data are provided "as is," without warranties of any kind, express or implied, including accuracy, availability, or fitness for a particular purpose.',
      },
      {
        heading: "Limitation of liability",
        body: `To the maximum extent permitted by law, ${ENTITY_NAME} is not liable for any damages arising from your use of, or inability to use, the app, including reliance on price data that turns out to be inaccurate.`,
      },
      {
        heading: "Third-party services",
        body: "The app relies on API Aberta (apiaberta.pt) for fuel price data, Google's Routes API for \"On My Way\" driving directions, Supabase for backend hosting, Expo for notifications and app updates, and Apple (purchases, maps and, if you sign in, authentication) or Google (Google Play purchases and notifications on Android and, if you sign in with Google, authentication). Your use of those services is also subject to their own terms.",
      },
      {
        heading: "Changes",
        body: "We may update these terms from time to time. Continued use of the app after changes take effect means you accept the updated terms.",
      },
      {
        heading: "Contact",
        body: `Questions about these terms? Contact ${CONTACT_EMAIL}.`,
      },
    ],
  },
  pt: {
    title: "Termos de Utilização",
    updated: "Última atualização: outubro de 2026",
    sections: [
      {
        heading: "Aceitação",
        body: `Ao usares o Tanka („a app"), aceitas estes termos. Se não concordares, por favor não uses a app. A app é operada por ${ENTITY_NAME}.`,
      },
      {
        heading: "O que é a app",
        body: "O Tanka mostra preços de combustível em postos de abastecimento em Portugal, obtidos a partir do serviço API Aberta, para fins informativos. Os preços são reportados quase em tempo real, mas podem ocasionalmente estar atrasados, em falta ou incorretos. Confirma sempre o preço na bomba antes de abastecer — a app não substitui essa verificação.",
      },
      {
        heading: "Contas",
        body: "Se iniciares sessão, és responsável por manter a tua conta segura e por toda a atividade realizada através dela. Podes pedir a eliminação da tua conta a qualquer momento. Podemos suspender ou encerrar contas que abusem do serviço.",
      },
      {
        heading: "Tanka Pro e período experimental",
        body: "O Tanka Pro é uma compra única feita através da App Store (iPhone) ou do Google Play (Android), associada ao teu ID Apple ou conta Google e, quando tens sessão iniciada, à tua conta Tanka. O pagamento, os recibos e os reembolsos são tratados pela Apple ou pela Google, ao abrigo dos seus próprios termos; se uma compra for reembolsada, o Pro é desativado. As contas com sessão iniciada têm um período experimental gratuito de 5 dias, uma vez por pessoa. As funcionalidades e os preços podem mudar para compras futuras.",
      },
      {
        heading: "Utilização aceitável",
        body: "Não uses a app para extrair, revender ou redistribuir em massa os dados de preços subjacentes, tentar contornar limites de utilização, fazer engenharia inversa do backend, ou de outra forma interferir com o serviço ou com a API da API Aberta de formas que violem os próprios termos de utilização da API Aberta.",
      },
      {
        heading: "Sem garantias",
        body: "A app e os seus dados são fornecidos „tal como estão\", sem garantias de qualquer tipo, expressas ou implícitas, incluindo precisão, disponibilidade ou adequação a um fim específico.",
      },
      {
        heading: "Limitação de responsabilidade",
        body: `Na máxima medida permitida por lei, ${ENTITY_NAME} não é responsável por quaisquer danos resultantes do teu uso, ou incapacidade de usar, a app, incluindo confiar em dados de preços que se revelem incorretos.`,
      },
      {
        heading: "Serviços de terceiros",
        body: "A app depende da API Aberta (apiaberta.pt) para os dados de preços de combustível, da API Routes da Google para os trajetos de „A caminho\", da Supabase para o alojamento do backend, da Expo para notificações e atualizações da app, e da Apple (compras, mapas e, se iniciares sessão, autenticação) ou da Google (compras no Google Play e notificações no Android e, se iniciares sessão com a Google, autenticação). A tua utilização desses serviços está também sujeita aos respetivos termos próprios.",
      },
      {
        heading: "Alterações",
        body: "Podemos atualizar estes termos periodicamente. A utilização continuada da app após as alterações entrarem em vigor significa que aceitas os termos atualizados.",
      },
      {
        heading: "Contacto",
        body: `Tens dúvidas sobre estes termos? Contacta ${CONTACT_EMAIL}.`,
      },
    ],
  },
};

export const licenses: { pt: LegalDoc; en: LegalDoc } = {
  en: {
    title: "Licenses & Attribution",
    updated: "",
    sections: [
      {
        heading: "Fuel price data",
        body: "Provided by API Aberta (apiaberta.pt), an open-source initiative that aggregates Portuguese public-sector data; fuel prices are updated daily from Direção-Geral de Energia e Geologia (DGEG) sources.",
      },
      {
        heading: "Open-source software",
        body: "This app is built with React Native, Expo, and the following open-source packages, most under the MIT License: react-navigation, react-native-maps, react-native-svg, @react-native-async-storage/async-storage, @supabase/supabase-js, expo-location, expo-notifications, expo-apple-authentication, @react-native-google-signin/google-signin, expo-secure-store, expo-iap, expo-store-review, @expo/vector-icons, and their dependencies. Full license texts are included in each package's repository.",
      },
      {
        heading: "Maps",
        body: "Map tiles and data are provided by Apple Maps (iOS) or Google Maps (Android), subject to their respective terms of service.",
      },
    ],
  },
  pt: {
    title: "Licenças e Créditos",
    updated: "",
    sections: [
      {
        heading: "Dados de preços de combustível",
        body: "Fornecidos pela API Aberta (apiaberta.pt), uma iniciativa open-source que agrega dados públicos portugueses; os preços de combustível são atualizados diariamente com base em fontes da Direção-Geral de Energia e Geologia (DGEG).",
      },
      {
        heading: "Software open-source",
        body: "Esta app foi construída com React Native, Expo e os seguintes pacotes open-source, na sua maioria sob a Licença MIT: react-navigation, react-native-maps, react-native-svg, @react-native-async-storage/async-storage, @supabase/supabase-js, expo-location, expo-notifications, expo-apple-authentication, @react-native-google-signin/google-signin, expo-secure-store, expo-iap, expo-store-review, @expo/vector-icons e as suas dependências. Os textos de licença completos estão incluídos no repositório de cada pacote.",
      },
      {
        heading: "Mapas",
        body: "Os mapas e dados cartográficos são fornecidos pela Apple Maps (iOS) ou Google Maps (Android), sujeitos aos respetivos termos de serviço.",
      },
    ],
  },
};
