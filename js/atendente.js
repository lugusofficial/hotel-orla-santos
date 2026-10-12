// Atendente de demonstracao: balao de conversa que responde sobre quartos,
// diarias, cafe da manha, horarios e localizacao, e entrega a conversa ao
// WhatsApp com a mensagem pronta.
//
// Duas partes separadas de proposito:
//   1. a interface (abrir, fechar, mensagens, chips, formulario), que nao sabe
//      de onde vem a resposta;
//   2. o cerebro, uma unica funcao responder(texto, memoria) que hoje e feita
//      de regras sobre o hotel.json e amanha pode virar um fetch para uma rota
//      com modelo de linguagem, sem mexer na interface.
//
// Progressivo: sem JavaScript o balao nem aparece, e o WhatsApp do rodape
// continua sendo o caminho de reserva. Os textos vem do bloco JSON da pagina,
// porque o arquivo e o mesmo em portugues e em ingles.
(function () {
  'use strict';

  var raiz = document.querySelector('[data-atendente]');
  if (!raiz) { return; }

  var FRASES = (function () {
    try { return JSON.parse(document.getElementById('i18n').textContent).bot || {}; }
    catch (e) { return {}; }
  })();
  var fr = function (chave, reserva) { return FRASES[chave] || reserva; };
  var EN = (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  var WA = raiz.getAttribute('data-whatsapp') || '#';
  // Caminho a partir do script, nao da pagina: en/ pediria en/data, que nao existe.
  var script = document.currentScript;
  var DADOS = script ? new URL('../data/hotel.json', script.src).href : 'data/hotel.json';
  var PREFIXO = EN ? '../' : '';

  // ------------------------------------------------------------- interface
  var abrir = raiz.querySelector('[data-atendente-abrir]');
  var fechar = raiz.querySelector('[data-atendente-fechar]');
  var painel = raiz.querySelector('[data-atendente-painel]');
  var lista = raiz.querySelector('[data-atendente-mensagens]');
  var chips = raiz.querySelector('[data-atendente-chips]');
  var form = raiz.querySelector('[data-atendente-form]');
  var campo = form && form.querySelector('input');
  if (!abrir || !fechar || !painel || !lista || !chips || !form || !campo) { return; }

  raiz.hidden = false;

  var hotel = null;
  var memoria = { hospedes: null, vista: null, tipo: null, datas: null };
  var saudou = false;

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mensagem(html, de) {
    var li = document.createElement('li');
    li.setAttribute('data-de', de);
    li.innerHTML = html;
    lista.appendChild(li);
    lista.scrollTop = lista.scrollHeight;
  }

  function mostrarChips(itens) {
    chips.innerHTML = '';
    itens.forEach(function (item) {
      var li = document.createElement('li');
      if (item.href) {
        var a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.rotulo;
        li.appendChild(a);
      } else {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = item.rotulo;
        b.addEventListener('click', function () { enviar(item.texto || item.rotulo); });
        li.appendChild(b);
      }
      chips.appendChild(li);
    });
  }

  function enviar(texto) {
    texto = (texto || '').trim();
    if (!texto) { return; }
    mensagem(escapar(texto), 'visitante');
    campo.value = '';
    var saida = responder(texto, memoria);
    saida.respostas.forEach(function (r) { mensagem(r, 'hotel'); });
    mostrarChips(saida.chips);
  }

  function abrirPainel() {
    painel.hidden = false;
    raiz.setAttribute('data-aberto', 'true');
    abrir.setAttribute('aria-expanded', 'true');
    if (!saudou) {
      saudou = true;
      mensagem(fr('saudacao', 'Olá! Sou o atendente de demonstração. Posso dizer quais quartos estão livres, a diária de cada um, o que inclui o café da manhã e como chegar.'), 'hotel');
      mostrarChips(chipsIniciais());
    }
    campo.focus();
  }

  function fecharPainel() {
    painel.hidden = true;
    raiz.removeAttribute('data-aberto');
    abrir.setAttribute('aria-expanded', 'false');
    abrir.focus();
  }

  abrir.addEventListener('click', abrirPainel);
  fechar.addEventListener('click', fecharPainel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !painel.hidden) { fecharPainel(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    enviar(campo.value);
  });

  // Os dados sobem quando o balao abre pela primeira vez, nao no carregamento
  // da pagina: quem nao conversa nao baixa o hotel.json.
  abrir.addEventListener('click', function () {
    if (hotel) { return; }
    fetch(DADOS).then(function (r) { return r.json(); }).then(function (h) { hotel = h; })
      .catch(function () { hotel = null; });
  }, { once: true });

  function chipsIniciais() {
    return [
      { rotulo: fr('chipMar', 'Tem quarto frente mar?') },
      { rotulo: fr('chipPreco', 'Quanto custa a diária?') },
      { rotulo: fr('chipCafe', 'Café da manhã') },
      { rotulo: fr('chipChegar', 'Como chegar') },
      { rotulo: fr('chipWhats', 'Falar no WhatsApp'), href: linkWhats() },
    ];
  }

  function linkWhats() {
    var partes = [fr('waOla', 'Olá! Vim pelo site.')];
    if (memoria.tipo) { partes.push(fr('waTipo', 'Quero o {tipo}.').replace('{tipo}', nomeTipo(memoria.tipo))); }
    else if (memoria.vista === 'mar') { partes.push(fr('waMar', 'Quero um quarto de frente para o mar.')); }
    if (memoria.hospedes) { partes.push(fr('waHosp', 'Somos {n}.').replace('{n}', memoria.hospedes)); }
    if (memoria.datas) { partes.push(fr('waDatas', 'Datas: {datas}.').replace('{datas}', memoria.datas)); }
    return WA + '?text=' + encodeURIComponent(partes.join(' '));
  }

  function nomeTipo(chave) {
    var t = hotel && hotel.tipos[chave];
    return (FRASES.tipos && FRASES.tipos[chave]) || (t && t.nome) || chave;
  }

  function dinheiro(v) { return 'R$ ' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // ---------------------------------------------------------------- cerebro
  // Regras por palavra chave, em portugues e em ingles. Cada intencao tem um
  // padrao e uma funcao que escreve a resposta a partir da memoria da conversa.
  // A ordem importa: a primeira que casa responde primeiro, e ate duas
  // intencoes respondem na mesma mensagem, para "tem vaga e quanto custa" nao
  // perder a segunda metade.
  var INTENCOES = [
    { nome: 'humano', re: /whats|zap|atendente|pessoa|humano|falar com|telefone|ligar|human|someone|phone|call|talk to/i },
    { nome: 'disponibilidade', re: /vaga|dispon[ií]vel|livre|tem quarto|quarto para|quero reservar|reserv|hospedar|fim de semana|feriado|available|availability|book|vacanc|room for|stay/i },
    { nome: 'preco', re: /pre[çc]o|di[áa]ria|valor|quanto|custa|tarifa|price|rate|cost|how much|cheap/i },
    { nome: 'cafe', re: /caf[ée]|breakfast|manh[ãa]/i },
    { nome: 'horario', re: /check|hor[áa]rio|entrada|sa[íi]da|que horas|chegar [àa]s|time|hour|late|cedo|early/i },
    { nome: 'estacionamento', re: /estacion|garagem|carro|vaga de carro|parking|park|car\b/i },
    { nome: 'local', re: /onde|endere[çc]o|localiza|praia|chegar|fica|longe|perto|where|location|address|beach|far|near|distance/i },
    { nome: 'wifi', re: /wi-?fi|internet/i },
    { nome: 'pet', re: /\bpet|cachorro|gato|animal|\bdog|\bcat\b/i },
    { nome: 'cancelamento', re: /cancel|pol[íi]tica|policy|refund|reembolso/i },
    { nome: 'obrigado', re: /obrigad|valeu|thanks|thank you|brigad/i },
    { nome: 'saudacao', re: /^(oi|ol[áa]|bom dia|boa tarde|boa noite|hello|hi|hey)\b/i },
  ];

  // Devolve true quando a mensagem de agora trouxe hospedes, vista, tipo ou
  // datas: so entao "quarto para 2" sem verbo vale como pedido de vaga. Sem
  // isso, qualquer coisa sem sentido depois de uma pergunta de vaga repetia a
  // lista de quartos, porque a memoria antiga ainda estava la.
  function lerMemoria(texto, memoria) {
    var antes = JSON.stringify(memoria);
    var t = texto.toLowerCase();
    var n = t.match(/(\d+)\s*(pessoas?|h[óo]spedes?|adultos?|people|guests?|adults?)/);
    if (n) { memoria.hospedes = Math.min(4, Math.max(1, parseInt(n[1], 10))); }
    else if (/casal|couple|dois|duas|two|\b2\b/.test(t)) { memoria.hospedes = 2; }
    else if (/fam[íi]lia|family|quatro|four|\b4\b/.test(t)) { memoria.hospedes = 4; }
    else if (/tr[êe]s|three|\b3\b/.test(t)) { memoria.hospedes = 3; }
    else if (/sozinh|alone|single|uma pessoa|one person|\b1\b/.test(t)) { memoria.hospedes = 1; }
    if (/mar|sea|ocean|praia|beach|vista/.test(t)) { memoria.vista = 'mar'; }
    if (/cidade|city|mais barat|cheaper/.test(t)) { memoria.vista = 'cidade'; }
    if (/qu[áa]drupl|quadruple/.test(t)) { memoria.tipo = 'quadruplo'; }
    else if (/frente mar|sea front|seafront/.test(t)) { memoria.tipo = 'frentemar'; }
    else if (/duplo|double/.test(t)) { memoria.tipo = 'duplo'; }
    var d = t.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:\s*(?:a|at[ée]|to|-)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?/);
    if (d) { memoria.datas = d[2] ? d[1] + ' ' + fr('ate', 'até') + ' ' + d[2] : d[1]; }
    return JSON.stringify(memoria) !== antes;
  }

  function tiposQueServem(memoria) {
    if (!hotel) { return []; }
    return Object.keys(hotel.tipos).filter(function (k) {
      var t = hotel.tipos[k];
      if (memoria.tipo && memoria.tipo !== k) { return false; }
      if (memoria.hospedes && t.hosp < memoria.hospedes) { return false; }
      if (memoria.vista === 'mar' && k !== 'frentemar') { return false; }
      if (memoria.vista === 'cidade' && k === 'frentemar') { return false; }
      return true;
    });
  }

  function livresDoTipo(k) {
    var n = 0;
    var menor = null;
    hotel.andares.forEach(function (a) {
      a.quartos.forEach(function (q) {
        if (q.tipo !== k || q.status !== 'disponivel') { return; }
        n += 1;
        if (menor === null || q.precoBase < menor) { menor = q.precoBase; }
      });
    });
    return { n: n, menor: menor };
  }

  function linhaTipo(k) {
    var t = hotel.tipos[k];
    var l = livresDoTipo(k);
    return '<a href="' + PREFIXO + t.pagina + '">' + escapar(nomeTipo(k)) + '</a>: '
      + fr('linhaTipo', '{n} livres, a partir de {preco}, até {hosp} hóspedes')
        .replace('{n}', l.n).replace('{preco}', dinheiro(l.menor || t.base)).replace('{hosp}', t.hosp);
  }

  var RESPOSTAS = {
    saudacao: function () { return fr('oi', 'Olá! Em que posso ajudar?'); },
    obrigado: function () { return fr('deNada', 'Por nada. Se quiser reservar, é só abrir o WhatsApp aqui embaixo.'); },
    humano: function () {
      return fr('humano', 'Claro. A recepção atende 24 horas pelo WhatsApp, e a conversa já vai com o que você me contou.')
        + ' <a href="' + linkWhats() + '">' + fr('abrirWhats', 'Abrir o WhatsApp') + '</a>';
    },
    disponibilidade: function (m) {
      if (!hotel) { return fr('semDados', 'Não consegui carregar a lista de quartos. A recepção responde na hora pelo WhatsApp.'); }
      var tipos = tiposQueServem(m);
      if (!tipos.length) {
        return fr('nenhum', 'Para esse número de hóspedes não tenho um tipo que sirva num quarto só. O Quádruplo recebe até 4; para mais pessoas, a recepção monta a combinação pelo WhatsApp.');
      }
      var intro = m.hospedes
        ? fr('paraN', 'Para {n} hóspedes, hoje tenho:').replace('{n}', m.hospedes)
        : fr('hoje', 'Hoje tenho livres:');
      return intro + '<ul>' + tipos.map(function (k) { return '<li>' + linhaTipo(k) + '</li>'; }).join('') + '</ul>'
        + fr('demoDisp', 'Disponibilidade e diárias de demonstração; a recepção confirma pelo WhatsApp.');
    },
    preco: function (m) {
      if (!hotel) { return fr('semDados', 'Não consegui carregar a lista de quartos. A recepção responde na hora pelo WhatsApp.'); }
      var tipos = tiposQueServem(m);
      if (!tipos.length) { tipos = Object.keys(hotel.tipos); }
      return fr('precos', 'Diárias a partir de:') + '<ul>' + tipos.map(function (k) {
        var t = hotel.tipos[k];
        return '<li><a href="' + PREFIXO + t.pagina + '">' + escapar(nomeTipo(k)) + '</a>: ' + dinheiro(t.base)
          + ' ' + fr('porNoite', 'a diária, com café da manhã') + '</li>';
      }).join('') + '</ul>' + fr('sobeAndar', 'Quanto mais alto o andar, um pouco mais cara a diária, porque mais mar entra na janela.');
    },
    cafe: function () {
      return fr('cafe', 'O café da manhã está incluso e é servido todos os dias no salão do térreo, com frutas, pães, frios, bolos e bebidas quentes.')
        + ' <a href="' + PREFIXO + 'cafe-da-manha.html">' + fr('verCafe', 'Ver o café da manhã') + '</a>';
    },
    horario: function () { return fr('horario', 'Check in a partir das 14h e check out até as 12h. A recepção funciona 24 horas e guarda bagagem antes e depois.'); },
    estacionamento: function () { return fr('estacionamento', 'Estacionamento: disponibilidade e valor a confirmar pelo hotel. A recepção responde na hora pelo WhatsApp.'); },
    local: function () {
      return fr('local', 'Estamos a uma quadra da praia, no José Menino, em Santos: atravessou a avenida da orla, chegou na areia. Jardins, ciclovia e quiosques na porta.')
        + ' <a href="' + PREFIXO + 'localizacao.html">' + fr('verLocal', 'Ver a localização') + '</a>';
    },
    wifi: function () { return fr('wifi', 'Wi-Fi em todo o hotel, nos quartos, no salão e no terraço, sem custo.'); },
    pet: function () { return fr('pet', 'Sobre animais de estimação a política é a confirmar pelo hotel; pergunte à recepção pelo WhatsApp antes de reservar.'); },
    cancelamento: function () { return fr('cancelamento', 'A política de cancelamento é a confirmar pelo hotel. A recepção informa pelo WhatsApp junto com a reserva.'); },
    naoEntendi: function () { return fr('naoEntendi', 'Não entendi essa. Posso falar de quartos livres, diárias, café da manhã, horários e como chegar. Para o resto, a recepção responde pelo WhatsApp.'); },
  };

  function chipsDepois(nomes, m) {
    var lista = [];
    if (nomes.indexOf('disponibilidade') >= 0 || nomes.indexOf('preco') >= 0) {
      lista.push({ rotulo: fr('chipReservar', 'Reservar pelo WhatsApp'), href: linkWhats() });
      if (!m.vista) { lista.push({ rotulo: fr('chipMar', 'Tem quarto frente mar?') }); }
      if (!m.hospedes) { lista.push({ rotulo: fr('chipCasal', 'Somos um casal'), texto: fr('chipCasalTexto', 'Quarto para 2 pessoas') }); }
    } else {
      lista.push({ rotulo: fr('chipDisp', 'Quais quartos estão livres?') });
      lista.push({ rotulo: fr('chipPreco', 'Quanto custa a diária?') });
      lista.push({ rotulo: fr('chipWhats', 'Falar no WhatsApp'), href: linkWhats() });
    }
    return lista;
  }

  // A unica porta do cerebro. Para trocar por um modelo de linguagem, esta
  // funcao passa a chamar uma rota propria e devolver o mesmo formato.
  function responder(texto, memoria) {
    var trouxeDados = lerMemoria(texto, memoria);
    var nomes = INTENCOES.filter(function (i) { return i.re.test(texto); }).map(function (i) { return i.nome; });
    // Saudacao sozinha responde; junto com outra coisa, a outra coisa vale mais.
    if (nomes.length > 1) { nomes = nomes.filter(function (n) { return n !== 'saudacao'; }); }
    // "quarto para 2" sem verbo de reserva ainda e pedido de disponibilidade.
    if (!nomes.length && trouxeDados) { nomes = ['disponibilidade']; }
    var usados = nomes.slice(0, 2);
    var respostas = usados.length
      ? usados.map(function (n) { return RESPOSTAS[n](memoria); })
      : [RESPOSTAS.naoEntendi(memoria)];
    return { respostas: respostas, chips: chipsDepois(usados, memoria) };
  }
})();
