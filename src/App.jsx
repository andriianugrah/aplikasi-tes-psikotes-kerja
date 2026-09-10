import { useState, useMemo, useEffect, useRef } from "react";

// ---------- Seeded RNG ----------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function fmtRp(n) {
  return "Rp" + n.toLocaleString("id-ID");
}

// ---------- Question generators ----------
function genKetelitian(rng, n) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const len = randInt(rng, 7, 10);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    let base = "";
    for (let k = 0; k < len; k++) base += chars[randInt(rng, 0, chars.length - 1)];
    const wantSame = rng() > 0.45;

    let isSame = true;
    let variant = base;
    let explain = "Kedua deret identik persis, karakter demi karakter.";

    if (!wantSame) {
      // cari posisi yang KARAKTERNYA BEDA dulu
      const candidatePositions = [];
      for (let p = 0; p < len - 1; p++) {
        if (base[p] !== base[p + 1]) candidatePositions.push(p);
      }

      if (candidatePositions.length > 0) {
        const pos = candidatePositions[randInt(rng, 0, candidatePositions.length - 1)];
        const arr = base.split("");
        [arr[pos], arr[pos + 1]] = [arr[pos + 1], arr[pos]];
        variant = arr.join("");
        isSame = false;
        explain = `Karakter pada posisi ke-${pos + 1} dan ke-${pos + 2} tertukar (${base.slice(pos, pos + 2)} vs ${variant.slice(pos, pos + 2)}).`;
      } else {
        // fallback langka: semua pasangan bersebelahan kebetulan sama
        const pos = randInt(rng, 0, len - 1);
        const original = base[pos];
        let replacement;
        do {
          replacement = chars[randInt(rng, 0, chars.length - 1)];
        } while (replacement === original);
        const arr = base.split("");
        arr[pos] = replacement;
        variant = arr.join("");
        isSame = false;
        explain = `Karakter pada posisi ke-${pos + 1} berbeda (${original} vs ${replacement}).`;
      }
    }

    items.push({ ... answer: isSame ? "SAMA" : "BEDA", ... });
  }
  return items;
}

function buildMCQ(rng, q, correctAns, explain, isRupiah = false, suffix = "") {
  const fmt = (v) => (isRupiah ? fmtRp(v) : `${v}${suffix}`);
  const distractors = new Set();
  while (distractors.size < 3) {
    const delta = randInt(rng, 1, Math.max(5, Math.round(Math.abs(correctAns) * 0.15))) * (rng() > 0.5 ? 1 : -1);
    const d = correctAns + delta;
    if (d !== correctAns) distractors.add(d);
  }
  const options = shuffle([correctAns, ...distractors], rng).map(fmt);
  return { q, options, answer: fmt(correctAns), explain };
}

function genNumerik(rng, n) {
  const items = [];
  const types = ["arit", "persen", "deret_plus", "deret_kali", "rata"];
  for (let i = 0; i < n; i++) {
    const type = types[i % types.length];
    if (type === "arit") {
      const a = randInt(rng, 20, 900);
      const b = randInt(rng, 20, 900);
      const c = randInt(rng, 5, 200);
      const ans = a + b - c;
      items.push(buildMCQ(rng, `${a} + ${b} − ${c} = ?`, ans, `${a} + ${b} = ${a + b}, lalu dikurangi ${c} = ${ans}.`));
    } else if (type === "persen") {
      const base = randInt(rng, 10, 90) * 10000;
      const pct = randInt(rng, 5, 30);
      const naik = rng() > 0.5;
      const result = naik ? Math.round(base * (1 + pct / 100)) : Math.round(base * (1 - pct / 100));
      items.push(
        buildMCQ(
          rng,
          `Nilai awal ${fmtRp(base)} ${naik ? "naik" : "turun"} sebesar ${pct}%. Berapa nilai akhirnya?`,
          result,
          `${fmtRp(base)} × ${naik ? `(1 + ${pct}%)` : `(1 − ${pct}%)`} = ${fmtRp(result)}.`,
          true
        )
      );
    } else if (type === "deret_plus") {
      const start = randInt(rng, 2, 15);
      const step = randInt(rng, 2, 9);
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      const ans = start + 4 * step;
      items.push(buildMCQ(rng, `Lanjutkan deret: ${seq.join(", ")}, ...?`, ans, `Pola bertambah tetap +${step} setiap suku.`));
    } else if (type === "deret_kali") {
      const start = randInt(rng, 2, 5);
      const mult = randInt(rng, 2, 3);
      const seq = [start, start * mult, start * mult * mult, start * mult * mult * mult];
      const ans = start * Math.pow(mult, 4);
      items.push(buildMCQ(rng, `Lanjutkan deret: ${seq.join(", ")}, ...?`, ans, `Pola dikali ${mult} setiap suku.`));
    } else {
      const vals = [randInt(rng, 40, 90), randInt(rng, 40, 90), randInt(rng, 40, 90)];
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      items.push(
        buildMCQ(rng, `Rata-rata dari ${vals.join(", ")} (dalam juta rupiah) adalah?`, avg, `(${vals.join(" + ")}) ÷ ${vals.length} = ${avg}.`, false, " juta")
      );
    }
  }
  return items;
}

function genAkuntansi(rng, n) {
  const bank = [
    ["Manakah yang termasuk akun Aset?", ["Kas", "Utang usaha", "Modal saham", "Pendapatan diterima di muka"], "Kas", "Kas adalah aset lancar; sisanya adalah liabilitas atau ekuitas."],
    ["Manakah yang termasuk akun Liabilitas?", ["Piutang usaha", "Utang bank", "Peralatan kantor", "Kas kecil"], "Utang bank", "Utang bank adalah kewajiban perusahaan kepada pihak lain."],
    ["Persamaan dasar akuntansi yang benar adalah?", ["Aset = Liabilitas + Ekuitas", "Aset = Ekuitas − Liabilitas", "Liabilitas = Aset + Ekuitas", "Ekuitas = Liabilitas × Aset"], "Aset = Liabilitas + Ekuitas", "Ini adalah fondasi dasar penyusunan neraca."],
    ["Rasio yang mengukur kemampuan melunasi kewajiban jangka pendek dengan aset lancar disebut?", ["Current ratio", "Debt to equity ratio", "Net profit margin", "Return on asset"], "Current ratio", "Current ratio = Aset lancar ÷ Liabilitas lancar."],
    ["Dalam laporan arus kas, penerimaan dari penjualan tunai termasuk aktivitas?", ["Investasi", "Pendanaan", "Operasi", "Non-kas"], "Operasi", "Penjualan tunai adalah bagian dari kegiatan operasional utama perusahaan."],
    ["Metode pencatatan yang mengakui pendapatan saat terjadi (bukan saat kas diterima) disebut?", ["Metode kas", "Metode akrual", "Metode FIFO", "Metode LIFO"], "Metode akrual", "Akrual mencatat transaksi berdasarkan kejadian ekonomi, bukan pergerakan kas."],
    ["Apa tujuan utama rekonsiliasi bank?", ["Menyamakan saldo buku dengan rekening koran dan menemukan penyebab selisih", "Menghitung pajak penghasilan", "Menyusun laporan laba rugi", "Menilai kinerja karyawan"], "Menyamakan saldo buku dengan rekening koran dan menemukan penyebab selisih", "Rekonsiliasi menelusuri item penyebab selisih seperti cek beredar atau biaya bank."],
    ["Fungsi neraca saldo (trial balance) adalah?", ["Memastikan total debit dan kredit seimbang", "Menghitung laba per saham", "Menentukan harga pokok penjualan", "Mengaudit laporan tahunan"], "Memastikan total debit dan kredit seimbang", "Neraca saldo adalah langkah pengecekan sebelum penyusunan laporan keuangan."],
    ["Beban penyusutan (depresiasi) termasuk dalam kategori?", ["Beban non-kas dalam laporan laba rugi", "Aset lancar", "Liabilitas jangka pendek", "Pendapatan lain-lain"], "Beban non-kas dalam laporan laba rugi", "Depresiasi mengurangi laba tapi tidak melibatkan arus kas keluar langsung."],
    ["Fungsi VLOOKUP/XLOOKUP di spreadsheet adalah?", ["Mencari nilai yang cocok dari tabel lain berdasarkan kunci pencarian", "Menghitung total otomatis", "Membuat grafik", "Memformat sel"], "Mencari nilai yang cocok dari tabel lain berdasarkan kunci pencarian", "Fungsi ini penting untuk mencocokkan data antar tabel, misalnya kode akun dengan nama akun."],
    ["Pivot table paling tepat digunakan untuk?", ["Meringkas data besar menjadi ringkasan per kategori", "Mengubah format file", "Mengenkripsi data", "Membuat rumus manual satu per satu"], "Meringkas data besar menjadi ringkasan per kategori", "Pivot table mengagregasi data tanpa mengubah data mentah aslinya."],
    ["Selisih antara pendapatan dan harga pokok penjualan disebut?", ["Laba kotor", "Laba bersih", "Laba ditahan", "Laba operasional"], "Laba kotor", "Laba kotor = Pendapatan − HPP, sebelum dikurangi beban operasional."],
    ["Piutang yang kemungkinan besar tidak akan tertagih dicatat sebagai?", ["Cadangan kerugian piutang (allowance for doubtful accounts)", "Aset tetap", "Pendapatan diterima di muka", "Modal disetor"], "Cadangan kerugian piutang (allowance for doubtful accounts)", "Ini adalah estimasi kehati-hatian atas piutang yang berisiko tidak tertagih."],
    ["Debt to equity ratio yang meningkat tajam biasanya mengindikasikan?", ["Peningkatan risiko keuangan karena pendanaan lebih bergantung pada utang", "Penurunan risiko keuangan", "Peningkatan laba bersih otomatis", "Tidak ada dampak pada risiko"], "Peningkatan risiko keuangan karena pendanaan lebih bergantung pada utang", "Rasio ini membandingkan total utang terhadap ekuitas pemegang saham."],
    ["Ketika menemukan data ganda (duplikat) dalam dataset transaksi sebelum analisis, langkah tepat adalah?", ["Mengidentifikasi dan menghapus duplikat setelah memverifikasi bahwa itu benar kesalahan input", "Membiarkannya karena tidak berpengaruh", "Menggandakan seluruh data agar konsisten", "Mengganti semua data dengan nol"], "Mengidentifikasi dan menghapus duplikat setelah memverifikasi bahwa itu benar kesalahan input", "Verifikasi dulu sebelum menghapus duplikat kadang mencerminkan transaksi sah yang terjadi dua kali."],
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [q, opts, ans, explain] = bank[i % bank.length];
    out.push({ q, options: shuffle(opts, rng), answer: ans, explain });
  }
  return out;
}

function genVerbal(rng, n) {
  const bank = [
    ["AKURAT = ?", ["Tepat", "Lambat", "Rumit", "Mahal"], "Tepat", "Sinonim akurat adalah tepat atau cermat."],
    ["REKONSILIASI = ?", ["Penyesuaian", "Pembatalan", "Penambahan", "Pengurangan"], "Penyesuaian/pencocoka", "Rekonsiliasi berarti proses mencocokkan dua catatan."],
    ["VALIDASI = ?", ["Pengesahan/pembuktian kebenaran", "Penghapusan", "Penundaan", "Pengulangan"], "Pengesahan/pembuktian kebenaran", "Validasi berarti proses memastikan/mengesahkan kebenaran sesuatu."],
    ["SURPLUS >< ?", ["Defisit", "Untung", "Stabil", "Neutral"], "Defisit", "Surplus (kelebihan) berlawanan dengan defisit (kekurangan)."],
    ["KONSOLIDASI >< ?", ["Disintegrasi", "Penggabungan", "Penguatan", "Sinkronisasi"], "Disintegrasi", "Konsolidasi (penggabungan/penguatan) berlawanan dengan pemisahan."],
    ["LIKUID >< ?", ["Ilikuid", "Cair", "Solvent", "Stabil"], "Ilikuid", "Likuid (mudah dicairkan) berlawanan dengan ilikuid."],
    ["NERACA : POSISI KEUANGAN = LABA RUGI : ?", ["Kinerja keuangan", "Arus kas", "Modal kerja", "Aset tetap"], "Kinerja keuangan", "Neraca menunjukkan posisi keuangan; laporan laba rugi menunjukkan kinerja keuangan."],
    ["AUDIT : VERIFIKASI = BUDGET : ?", ["Perencanaan", "Pengeluaran", "Pemasukan", "Investasi"], "Perencanaan", "Audit berfungsi memverifikasi; budget berfungsi merencanakan."],
    ["EFISIEN = ?", ["Hemat sumber daya", "Boros", "Lambat", "Rumit"], "Hemat sumber daya", "Efisien berarti menggunakan sumber daya secara optimal/hemat."],
    ["TRANSPARAN >< ?", ["Tertutup", "Jelas", "Terbuka", "Jujur"], "Tertutup/tersembunyi", "Transparan (terbuka/jelas) berlawanan dengan tertutup."],
    ["OTORISASI = ?", ["Pemberian wewenang", "Pembatalan", "Penundaan", "Investigasi"], "Pemberian wewenang", "Otorisasi berarti pemberian izin atau wewenang secara resmi."],
    ["DEBITUR : KREDITUR = PEMINJAM : ?", ["Pemberi pinjaman", "Penjamin", "Investor", "Auditor"], "Pemberi pinjaman", "Debitur adalah pihak yang berutang, kreditur adalah pemberi pinjaman, sama seperti hubungan peminjam dan pemberi pinjaman."],
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [q, opts, ans, explain] = bank[i % bank.length];
    out.push({ q, options: shuffle(opts, rng), answer: ans, explain });
  }
  return out;
}

function genPenalaran(rng, n) {
  const names = ["Rina", "Budi", "Sari", "Dedi", "Ayu", "Fajar", "Nina", "Doni"];
  const items = [];
  const types = ["modus_ponens", "modus_tollens", "silogisme", "urutan"];
  for (let i = 0; i < n; i++) {
    const type = types[i % types.length];
    const name = names[randInt(rng, 0, names.length - 1)];
    if (type === "modus_ponens") {
      items.push({
        q: `Jika data telah diverifikasi, maka laporan dapat disetujui. Data ini telah diverifikasi. Kesimpulan yang sah adalah?`,
        options: shuffle(["Laporan ini dapat disetujui", "Laporan ini pasti ditolak", "Data belum lengkap", "Tidak dapat disimpulkan"], rng),
        answer: "Laporan ini dapat disetujui",
        explain: "Modus ponens: dari 'jika P maka Q' dan 'P benar', disimpulkan 'Q benar'.",
      });
    } else if (type === "modus_tollens") {
      items.push({
        q: `Jika target tercapai, maka bonus dicairkan. Bonus tidak dicairkan. Kesimpulan yang sah adalah?`,
        options: shuffle(["Target tidak tercapai", "Target pasti tercapai", "Bonus akan dicairkan bulan depan", "Tidak dapat disimpulkan"], rng),
        answer: "Target tidak tercapai",
        explain: "Modus tollens: dari 'jika P maka Q' dan 'tidak Q', disimpulkan 'tidak P'.",
      });
    } else if (type === "silogisme") {
      items.push({
        q: `Semua staf accounting wajib memahami PSAK. ${name} adalah staf accounting. Kesimpulan yang sah adalah?`,
        options: shuffle([`${name} wajib memahami PSAK`, `${name} tidak wajib memahami PSAK`, `${name} bukan staf accounting`, "Tidak dapat disimpulkan"], rng),
        answer: `${name} wajib memahami PSAK`,
        explain: "Silogisme kategoris langsung: semua anggota kelompok memenuhi syarat yang berlaku untuk kelompok tersebut.",
      });
    } else {
      items.push({
        q: `Laporan C diserahkan sebelum Laporan A. Laporan C diserahkan setelah Laporan B. Manakah urutan yang benar dari yang paling awal?`,
        options: shuffle(["A, B, C", "C, B, A", "B, A, C", "A, C, B"], rng),
        answer: "B, C, A",
        explain: "Relasi urutan bersifat transitif: B sebelum C, C sebelum A, maka A setelah C.",
      });
    }
  }
  return items;
}

const PER_SECTION = 50;
const PASS_THRESHOLD = 0.6;

const SECTIONS = [
  { id: "ketelitian", label: "Ketelitian Data", accent: "#3E7A57", gen: genKetelitian, timeLimitSec: 8 * 60 },
  { id: "numerik", label: "Logika Numerik", accent: "#A9822F", gen: genNumerik, timeLimitSec: 12 * 60 },
  { id: "akuntansi", label: "Akuntansi & Analisis Data", accent: "#3B5E8C", gen: genAkuntansi, timeLimitSec: 12 * 60 },
  { id: "verbal", label: "Tes Verbal", accent: "#77568F", gen: genVerbal, timeLimitSec: 8 * 60 },
  { id: "penalaran", label: "Logika Penalaran", accent: "#9C4A45", gen: genPenalaran, timeLimitSec: 10 * 60 },
];

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ---------- Elegant design tokens ----------
const INK = "#1E251E";
const INK_SOFT = "#4A5248";
const MUTED = "#8C8672";
const CREAM = "#FAF8F2";
const CARD = "#FFFFFF";
const LINE = "#E7E1D2";
const GOLD = "#A6823F";
const GOOD_BG = "#EAF3EC";
const GOOD_BORDER = "#3E7A57";
const GOOD_TEXT = "#1F5A3B";
const BAD_BG = "#F8ECEA";
const BAD_BORDER = "#B0605A";
const BAD_TEXT = "#8B3A34";
const SERIF = "'Georgia', 'Iowan Old Style', serif";
const MONO = "'Courier New', monospace";
const CARD_SHADOW = "0 1px 2px rgba(30,37,30,0.04), 0 4px 14px rgba(30,37,30,0.05)";
const RADIUS = 10;

const btnPrimary = {
  padding: "13px 30px",
  background: INK,
  color: CREAM,
  border: "none",
  borderRadius: RADIUS - 3,
  fontSize: 15,
  fontFamily: SERIF,
  letterSpacing: 0.2,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(30,37,30,0.18)",
};
const btnPrimaryDisabled = {
  ...btnPrimary,
  background: "#D3CDBB",
  color: "#8C8672",
  cursor: "not-allowed",
  boxShadow: "none",
};
const btnSecondary = {
  padding: "13px 30px",
  background: CARD,
  color: INK,
  border: `1px solid ${LINE}`,
  borderRadius: RADIUS - 3,
  fontSize: 15,
  fontFamily: SERIF,
  letterSpacing: 0.2,
  cursor: "pointer",
};
const btnCompactPrimary = {
  ...btnPrimary,
  padding: "8px 18px",
  fontSize: 13,
  boxShadow: "0 1px 4px rgba(30,37,30,0.16)",
};

export default function App() {
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const rng = useMemo(() => mulberry32(seed), [seed]);

  const data = useMemo(() => {
    return SECTIONS.map((s) => ({ ...s, questions: s.gen(rng, PER_SECTION) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // screen: login | intro | quiz | sectionTransition | final
  const [screen, setScreen] = useState("login");
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState({});
  const [timeLeft, setTimeLeft] = useState(SECTIONS[0].timeLimitSec);
  const timerRef = useRef(null);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  const section = data[sectionIdx];
  const question = section ? section.questions[qIdx] : null;

  useEffect(() => {
    if (screen !== "quiz") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          finalizeSectionOnTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, sectionIdx]);

  function submitLogin() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setName(trimmed);
    setScreen("intro");
  }

  function startExam() {
    setSectionIdx(0);
    setQIdx(0);
    setSelected(null);
    setRevealed(false);
    setRecords({});
    setTimeLeft(SECTIONS[0].timeLimitSec);
    setScreen("quiz");
  }

  function finalizeSectionOnTimeout() {
    setRecords((r) => {
      const existing = r[section.id] || { correct: 0, total: 0 };
      return { ...r, [section.id]: existing };
    });
    setScreen("sectionTransition");
  }

  function choose(opt) {
    if (revealed) return;
    setSelected(opt);
    setRevealed(true);
  }

  function commitAnswerAndAdvance() {
    const correct = selected === question.answer;
    setRecords((r) => {
      const prev = r[section.id] || { correct: 0, total: 0 };
      return { ...r, [section.id]: { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 } };
    });
    setSelected(null);
    setRevealed(false);
    if (qIdx + 1 < section.questions.length) {
      setQIdx(qIdx + 1);
    } else {
      clearInterval(timerRef.current);
      setScreen("sectionTransition");
    }
  }

  function goToNextSection() {
    setRecords((r) => (r[section.id] ? r : { ...r, [section.id]: { correct: 0, total: 0 } }));
    if (sectionIdx + 1 < SECTIONS.length) {
      const nextIdx = sectionIdx + 1;
      setSectionIdx(nextIdx);
      setQIdx(0);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(SECTIONS[nextIdx].timeLimitSec);
      setScreen("quiz");
    } else {
      setScreen("final");
    }
  }

  function requestBackToHome() {
    clearInterval(timerRef.current);
    setShowBackConfirm(true);
  }

  function confirmBackToHome() {
    clearInterval(timerRef.current);
    setShowBackConfirm(false);
    setSectionIdx(0);
    setQIdx(0);
    setSelected(null);
    setRevealed(false);
    setRecords({});
    setTimeLeft(SECTIONS[0].timeLimitSec);
    setScreen("intro");
  }

  function cancelBackToHome() {
    setShowBackConfirm(false);
    if (screen === "quiz") {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            finalizeSectionOnTimeout();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
  }

  const finalStats = useMemo(() => {
    const perSection = SECTIONS.map((s) => {
      const rec = records[s.id] || { correct: 0, total: PER_SECTION };
      const pct = PER_SECTION > 0 ? rec.correct / PER_SECTION : 0;
      return { id: s.id, label: s.label, accent: s.accent, correct: rec.correct, total: PER_SECTION, pct };
    });
    const totalCorrect = perSection.reduce((a, s) => a + s.correct, 0);
    const totalQuestions = SECTIONS.length * PER_SECTION;
    const overallPct = totalCorrect / totalQuestions;
    const passed = overallPct >= PASS_THRESHOLD;
    const weakest = [...perSection].sort((a, b) => a.pct - b.pct);
    return { perSection, totalCorrect, totalQuestions, overallPct, passed, weakest };
  }, [records]);

  const timeWarn = timeLeft <= 30;

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: SERIF, color: INK }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "44px 24px 90px" }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 18, marginBottom: 32 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: 1.6,
              color: GOLD,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
          {name ? `· Peserta: ${name}` : "· Login Peserta"}
          </div>
          <h1 style={{ fontSize: 32, margin: 0, fontWeight: 400, lineHeight: 1.28, letterSpacing: 0.2 }}>
            Test Psikotest Kerja
          </h1>
        </div>

        {screen === "login" && (
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: "34px 30px" }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: INK_SOFT, marginTop: 0, marginBottom: 22 }}>
              Masukkan nama Anda untuk memulai sesi latihan. Nama ini hanya ditampilkan selama sesi berjalan dan tidak dikirim ke sistem manapun.
            </p>
            <label
              style={{
                display: "block",
                fontFamily: MONO,
                fontSize: 11,
                color: MUTED,
                marginBottom: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Nama Peserta
            </label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitLogin();
              }}
              placeholder="Contoh: Andri"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 16px",
                fontSize: 15,
                fontFamily: SERIF,
                border: `1px solid ${LINE}`,
                borderRadius: RADIUS - 4,
                marginBottom: 22,
                background: CREAM,
                color: INK,
                outline: "none",
              }}
            />
            <button onClick={submitLogin} disabled={!nameDraft.trim()} style={nameDraft.trim() ? btnPrimary : btnPrimaryDisabled}>
              Masuk
            </button>
          </div>
        )}

        {screen === "intro" && (
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: "32px 30px" }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: INK_SOFT, marginTop: 0 }}>
              Simulasi ini meniru struktur tes psikotes sungguhan: 5 bagian, masing-masing 50 soal, dengan batas waktu per bagian. Jika waktu satu bagian habis, sistem otomatis lanjut ke bagian berikutnya, soal yang belum terjawab dihitung sebagai tidak terjawab (salah).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "22px 0" }}>
              {SECTIONS.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: CREAM,
                    borderLeft: `3px solid ${s.accent}`,
                    borderRadius: 6,
                    fontSize: 14.5,
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: MUTED }}>
                    {PER_SECTION} soal · {Math.round(s.timeLimitSec / 60)} menit
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 26 }}>
              Ambang kelulusan simulasi ini ditetapkan pada {Math.round(PASS_THRESHOLD * 100)}% jawaban benar dari total 250 soal, angka ini hanya patokan latihan, bukan standar resmi.
            </p>
            <button onClick={startExam} style={btnPrimary}>
              Mulai Simulasi
            </button>
          </div>
        )}

        {screen === "quiz" && question && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <button onClick={requestBackToHome} style={btnCompactPrimary}>
                ← Kembali ke Home
              </button>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 15,
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: timeWarn ? BAD_BG : "#F1ECDD",
                  color: timeWarn ? BAD_TEXT : INK_SOFT,
                  fontWeight: "bold",
                  border: `1px solid ${timeWarn ? BAD_BORDER : LINE}`,
                }}
              >
                ⏱ {fmtTime(timeLeft)}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: section.accent, marginBottom: 14, letterSpacing: 0.5 }}>
              Bagian {sectionIdx + 1}/5 · {section.label} · Soal {qIdx + 1}/{PER_SECTION}
            </div>

            <div style={{ height: 5, background: "#EEE9DA", borderRadius: 3, marginBottom: 26, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${((qIdx + 1) / PER_SECTION) * 100}%`,
                  background: section.accent,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: "30px 30px 26px" }}>
              <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 0, marginBottom: question.code ? 16 : 22 }}>
                {question.q}
              </p>

              {question.code && (
                <pre
                  style={{
                    fontFamily: MONO,
                    fontSize: 14,
                    background: CREAM,
                    border: `1px solid ${LINE}`,
                    borderRadius: 6,
                    padding: "16px 18px",
                    marginBottom: 22,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.8,
                  }}
                >
                  {question.code}
                </pre>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {question.options.map((opt, oi) => {
                  const isCorrect = opt === question.answer;
                  const isSelected = opt === selected;
                  let bg = CARD;
                  let border = LINE;
                  let textColor = INK;
                  if (revealed) {
                    if (isCorrect) {
                      bg = GOOD_BG;
                      border = GOOD_BORDER;
                      textColor = GOOD_TEXT;
                    } else if (isSelected && !isCorrect) {
                      bg = BAD_BG;
                      border = BAD_BORDER;
                      textColor = BAD_TEXT;
                    }
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => choose(opt)}
                      disabled={revealed}
                      style={{
                        textAlign: "left",
                        padding: "13px 18px",
                        borderRadius: 8,
                        border: `1px solid ${border}`,
                        background: bg,
                        color: textColor,
                        fontSize: 15,
                        fontFamily: SERIF,
                        cursor: revealed ? "default" : "pointer",
                        lineHeight: 1.55,
                        transition: "background 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${LINE}` }}>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: selected === question.answer ? GOOD_TEXT : BAD_TEXT,
                      marginBottom: 10,
                      letterSpacing: 0.5,
                    }}
                  >
                    {selected === question.answer ? "✓ TEPAT" : "✕ KURANG TEPAT"} · JAWABAN: {question.answer}
                  </div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: 0, color: INK_SOFT }}>{question.explain}</p>
                  <button onClick={commitAnswerAndAdvance} style={{ ...btnPrimary, marginTop: 20, padding: "11px 24px", fontSize: 14 }}>
                    {qIdx + 1 === PER_SECTION ? "Selesaikan Bagian Ini" : "Soal Berikutnya →"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {screen === "sectionTransition" && (
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
              {timeLeft === 0 ? "Waktu Habis · " : ""}
              Bagian {sectionIdx + 1} Selesai {section.label}
            </div>
            <div style={{ fontSize: 44, fontWeight: 400, margin: "8px 0", color: section.accent }}>
              {(records[section.id]?.correct ?? 0)} / {PER_SECTION}
            </div>
            <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.7, maxWidth: 460, margin: "0 auto 28px" }}>
              {timeLeft === 0
                ? "Waktu untuk bagian ini telah habis. Soal yang belum sempat dijawab dihitung sebagai tidak terjawab, sesuai mekanisme tes psikotes sesungguhnya."
                : "Bagian ini telah diselesaikan sebelum waktu habis."}
            </p>
            <button onClick={goToNextSection} style={btnPrimary}>
              {sectionIdx + 1 < SECTIONS.length ? "Lanjut ke Bagian Berikutnya →" : "Lihat Hasil Akhir"}
            </button>
          </div>
        )}

        {screen === "final" && (
          <div>
            <div
              style={{
                background: finalStats.passed ? GOOD_BG : BAD_BG,
                border: `1px solid ${finalStats.passed ? GOOD_BORDER : BAD_BORDER}`,
                borderRadius: RADIUS,
                boxShadow: CARD_SHADOW,
                padding: "36px 30px",
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 1.4, marginBottom: 12, textTransform: "uppercase" }}>
                Hasil Simulasi Psikotes
              </div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 400,
                  color: finalStats.passed ? GOOD_TEXT : BAD_TEXT,
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                {finalStats.passed ? "LOLOS" : "TIDAK LOLOS"}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 15, color: INK_SOFT }}>
                {finalStats.totalCorrect} / {finalStats.totalQuestions} benar ({Math.round(finalStats.overallPct * 100)}%)
              </div>
              <p style={{ fontSize: 12.5, color: MUTED, marginTop: 14, lineHeight: 1.7 }}>
                Ambang lulus simulasi: {Math.round(PASS_THRESHOLD * 100)}%. Ini patokan latihan pribadi, bukan standar resmi.
              </p>
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 400, marginBottom: 16, letterSpacing: 0.2 }}>Rincian per Bagian</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 28 }}>
              {finalStats.perSection.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: CARD,
                    border: `1px solid ${LINE}`,
                    borderLeft: `4px solid ${s.accent}`,
                    borderRadius: 8,
                    boxShadow: CARD_SHADOW,
                    padding: "14px 18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
                    <span>{s.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13.5 }}>
                      {s.correct}/{s.total} ({Math.round(s.pct * 100)}%)
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#EEE9DA", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.pct * 100}%`, background: s.accent }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: CARD_SHADOW, padding: "24px 26px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 400, marginTop: 0, marginBottom: 14, letterSpacing: 0.2 }}>
                Bagian yang Paling Perlu Diperbaiki
              </h2>
              {finalStats.weakest.slice(0, 2).map((s, i) => (
                <p key={s.id} style={{ fontSize: 14.5, lineHeight: 1.7, margin: "0 0 12px" }}>
                  <strong style={{ color: s.accent }}>
                    {i + 1}. {s.label}
                  </strong>{" "}
                  {s.correct}/{s.total} benar ({Math.round(s.pct * 100)}%).{" "}
                  {s.pct < 0.5
                    ? "Skor di bawah 50% menandakan pemahaman dasar di area ini masih perlu diperkuat sebelum tes sesungguhnya."
                    : "Sudah cukup, tapi masih ada ruang untuk lebih teliti dan cepat."}
                </p>
              ))}
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 16 }}>
                Fokuskan sisa waktu latihan pada bagian di atas ulangi simulasi ini beberapa kali untuk melihat konsistensi peningkatan, bukan hanya hasil satu kali percobaan.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button onClick={startExam} style={btnPrimary}>
                Ulangi Simulasi
              </button>
              <button onClick={() => setScreen("intro")} style={btnPrimary}>
                Kembali ke Home
              </button>
            </div>
          </div>
        )}
      </div>

      {showBackConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(30,37,30,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: CARD,
              borderRadius: RADIUS,
              padding: "28px 26px",
              maxWidth: 380,
              width: "100%",
              fontFamily: SERIF,
              boxShadow: "0 12px 40px rgba(20,20,15,0.25)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 400, margin: "0 0 12px" }}>Kembali ke Home?</h3>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: INK_SOFT, margin: "0 0 24px" }}>
              Progres pada sesi ini (termasuk bagian yang sedang dikerjakan) akan hilang dan simulasi akan dimulai dari awal. Yakin ingin melanjutkan kembali ke home?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={cancelBackToHome} style={btnSecondary}>
                Batal, Lanjutkan Tes
              </button>
              <button
                onClick={confirmBackToHome}
                style={{
                  ...btnPrimary,
                  background: BAD_TEXT,
                  border: `1px solid ${INK}`,
                  boxShadow: "0 2px 8px rgba(139,58,52,0.35)",
                }}
              >
                Ya, Kembali ke Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
