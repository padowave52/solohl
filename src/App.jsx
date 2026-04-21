import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "solall_guest_site_v1";
const ADMIN_PASSWORD_KEY = "solall_admin_password_v1";
const ADMIN_SESSION_KEY = "solall_admin_session_v1";

const DEFAULT_ADMIN_PASSWORD = "solohl2026";

const initialData = {
  settings: {
    clubName: "솔올클럽 게스트 신청",
    bookingOpenHour: 12,
    defaultCapacity: 5,
  },
  daySettings: [],
  applications: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw);
    return {
      ...initialData,
      ...parsed,
      settings: { ...initialData.settings, ...(parsed.settings || {}) },
      daySettings: parsed.daySettings || [],
      applications: parsed.applications || [],
    };
  } catch {
    return initialData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function onlyDigits(value) {
  return String(value).replace(/\D/g, "");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function getTodayLocalDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthKey(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekOfMonth(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = first.getDay();
  return Math.ceil((d.getDate() + offset) / 7);
}

function getWeekLabel(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return `${d.getMonth() + 1}월 ${getWeekOfMonth(dateString)}째주`;
}

function getDaySetting(data, date) {
  return data.daySettings.find((d) => d.date === date);
}

function getCapacityForDate(data, date) {
  const daySetting = getDaySetting(data, date);
  return daySetting ? Number(daySetting.capacity) : Number(data.settings.defaultCapacity);
}

function isDateEnabled(data, date) {
  const daySetting = getDaySetting(data, date);
  return daySetting ? !!daySetting.enabled : true;
}

function canOpenByTime(date, openHour) {
  const today = getTodayLocalDateString();

  if (date !== today) return false;

  const now = new Date();
  return now.getHours() >= Number(openHour);
}
function countActiveApplicationsForDate(data, date) {
  return data.applications.filter(
    (app) => app.date === date && app.status !== "canceled"
  ).length;
}

function getAvailabilityText(data, date) {
  if (!date) return "날짜를 선택해주세요.";

  const today = getTodayLocalDateString();

  if (date < today) return "지난 날짜는 신청할 수 없습니다.";
  if (date > today) return "신청은 당일 오후 12시부터 가능합니다.";
  if (!isDateEnabled(data, date)) return "관리자가 신청 마감으로 설정한 날짜입니다.";

  if (!canOpenByTime(date, data.settings.bookingOpenHour)) {
    return `오늘 신청은 ${data.settings.bookingOpenHour}:00부터 가능합니다.`;
  }

  const cap = getCapacityForDate(data, date);
  const used = countActiveApplicationsForDate(data, date);
  const left = cap - used;

  if (left <= 0) return "마감된 날짜입니다.";
  return `신청 가능 · 남은 인원 ${left}명 / 총 ${cap}명`;
}

function statusText(status) {
  if (status === "confirmed") return "확정";
  if (status === "canceled") return "취소";
  return "보류";
}

function statusColor(status) {
  if (status === "confirmed") return "#15803d";
  if (status === "canceled") return "#dc2626";
  return "#b45309";
}

export default function App() {
  const [data, setData] = useState(initialData);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(
    localStorage.getItem(ADMIN_SESSION_KEY) === "logged-in"
  );
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const [applyForm, setApplyForm] = useState({
    date: "",
    name: "",
    level: "",
    birth6: "",
    phone: "",
    guestMember: "",
  });
  const [applyMessage, setApplyMessage] = useState("");

  const [checkBirth6, setCheckBirth6] = useState("");
  const [checkPhoneLast4, setCheckPhoneLast4] = useState("");
  const [checkResults, setCheckResults] = useState([]);
  const [checkSearched, setCheckSearched] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [archiveMonth, setArchiveMonth] = useState("");
  const [archiveWeek, setArchiveWeek] = useState("all");

  const [dayForm, setDayForm] = useState({
    date: "",
    enabled: true,
    capacity: 5,
  });

  const [newAdminPassword, setNewAdminPassword] = useState("");

  useEffect(() => {
    const loaded = loadData();
    const normalized = {
      ...loaded,
      applications: (loaded.applications || []).map((app) => ({
        ...app,
        phoneLast4: app.phoneLast4 || String(app.phone || "").slice(-4),
        guestMember: app.guestMember || app.guestOf || "",
      })),
    };
    setData(normalized);
  }, []);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const availabilityText = useMemo(() => {
    return getAvailabilityText(data, applyForm.date);
  }, [data, applyForm.date]);

  const monthOptions = useMemo(() => {
    const months = [
      ...new Set(
        data.applications
          .map((a) => getMonthKey(a.date))
          .concat(data.daySettings.map((d) => getMonthKey(d.date)))
      ),
    ].sort().reverse();

    const current = getCurrentMonthKey();
    if (!months.includes(current)) months.unshift(current);
    return [...new Set(months)];
  }, [data]);

  const currentMonthItems = useMemo(() => {
    return data.applications
      .filter((a) => getMonthKey(a.date) === selectedMonth)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }, [data, selectedMonth]);

  const archiveWeekOptions = useMemo(() => {
    if (!archiveMonth) return [];
    return [
      ...new Set(
        data.applications
          .filter((a) => getMonthKey(a.date) === archiveMonth)
          .map((a) => String(getWeekOfMonth(a.date)))
      ),
    ].sort((a, b) => Number(a) - Number(b));
  }, [data, archiveMonth]);

  const archiveItems = useMemo(() => {
    if (!archiveMonth) return [];
    return data.applications
      .filter((a) => getMonthKey(a.date) === archiveMonth)
      .filter((a) => archiveWeek === "all" || String(getWeekOfMonth(a.date)) === archiveWeek)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }, [data, archiveMonth, archiveWeek]);

  function handleApply() {
    const cleanBirth6 = onlyDigits(applyForm.birth6).slice(0, 6);
    const cleanPhone = onlyDigits(applyForm.phone).slice(0, 11);

    if (
      !applyForm.date ||
      !applyForm.name ||
      !applyForm.level ||
      !cleanBirth6 ||
      !cleanPhone ||
      !applyForm.guestMember
    ) {
      setApplyMessage("모든 항목을 입력해주세요.");
      return;
    }

    if (cleanBirth6.length !== 6) {
      setApplyMessage("생년월일 6자리를 정확히 입력해주세요.");
      return;
    }

    if (cleanPhone.length < 10) {
      setApplyMessage("전화번호를 정확히 입력해주세요.");
      return;
    }

    const today = getTodayLocalDateString();

    if (applyForm.date !== today) {
      setApplyMessage("신청은 당일 오후 12시부터만 가능합니다.");
      return;
    }

    if (!isDateEnabled(data, applyForm.date)) {
      setApplyMessage("해당 날짜는 신청 마감입니다.");
      return;
    }

    if (!canOpenByTime(applyForm.date, data.settings.bookingOpenHour)) {
      setApplyMessage(`해당 날짜 신청은 ${data.settings.bookingOpenHour}:00부터 가능합니다.`);
      return;
    }

    const cap = getCapacityForDate(data, applyForm.date);
    const used = countActiveApplicationsForDate(data, applyForm.date);
    if (used >= cap) {
      setApplyMessage("정원이 마감되었습니다.");
      return;
    }

    const duplicate = data.applications.some(
      (app) =>
        app.date === applyForm.date &&
        app.birth6 === cleanBirth6 &&
        app.phone === cleanPhone &&
        app.status !== "canceled"
    );

    if (duplicate) {
      setApplyMessage("이미 해당 날짜에 신청한 내역이 있습니다.");
      return;
    }

    const nextData = {
      ...data,
      applications: [
        ...data.applications,
        {
          id: crypto.randomUUID(),
          date: applyForm.date,
          name: applyForm.name,
          level: applyForm.level,
          birth6: cleanBirth6,
          phone: cleanPhone,
          phoneLast4: cleanPhone.slice(-4),
          guestMember: applyForm.guestMember,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setData(nextData);
    setApplyMessage("신청이 완료되었습니다. 신청확인에서 상태를 조회할 수 있습니다.");
    setApplyForm({
      date: "",
      name: "",
      level: "",
      birth6: "",
      phone: "",
      guestMember: "",
    });
  }

  function handleCheck() {
    const b = onlyDigits(checkBirth6).slice(0, 6);
    const p = onlyDigits(checkPhoneLast4).slice(0, 4);

    const found = data.applications
      .filter((app) => app.birth6 === b && app.phoneLast4 === p)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setCheckResults(found);
    setCheckSearched(true);
  }

  function handleAdminLogin() {
    const savedPassword = localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (adminPasswordInput === savedPassword) {
      localStorage.setItem(ADMIN_SESSION_KEY, "logged-in");
      setAdminLoggedIn(true);
      setAdminLoginError("");
    } else {
      setAdminLoginError("비밀번호가 일치하지 않습니다.");
    }
  }

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminLoggedIn(false);
  }

  function updateApplicationStatus(id, status) {
    const nextData = {
      ...data,
      applications: data.applications.map((app) =>
        app.id === id ? { ...app, status } : app
      ),
    };
    setData(nextData);
  }

  function deleteApplication(id) {
    const nextData = {
      ...data,
      applications: data.applications.filter((app) => app.id !== id),
    };
    setData(nextData);
  }

  function saveDaySetting() {
    if (!dayForm.date) return;

    const exists = data.daySettings.some((d) => d.date === dayForm.date);
    let nextDaySettings;

    if (exists) {
      nextDaySettings = data.daySettings.map((d) =>
        d.date === dayForm.date
          ? {
              ...d,
              enabled: dayForm.enabled,
              capacity: Number(dayForm.capacity),
            }
          : d
      );
    } else {
      nextDaySettings = [
        ...data.daySettings,
        {
          date: dayForm.date,
          enabled: dayForm.enabled,
          capacity: Number(dayForm.capacity),
        },
      ];
    }

    const nextData = {
      ...data,
      daySettings: nextDaySettings.sort((a, b) => a.date.localeCompare(b.date)),
    };

    setData(nextData);
    setDayForm({
      date: "",
      enabled: true,
      capacity: Number(data.settings.defaultCapacity),
    });
  }

  function removeDaySetting(date) {
    const nextData = {
      ...data,
      daySettings: data.daySettings.filter((d) => d.date !== date),
    };
    setData(nextData);
  }

  function saveAdminPassword() {
    if (!newAdminPassword.trim()) return;
    localStorage.setItem(ADMIN_PASSWORD_KEY, newAdminPassword.trim());
    setNewAdminPassword("");
    alert("관리자 비밀번호가 변경되었습니다.");
  }

  function groupByDate(items) {
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });
    return Object.entries(grouped);
  }

  const formColumns = windowWidth < 900 ? "1fr" : "1fr 1fr";
  const mainColumns = windowWidth < 1100 ? "1fr" : "minmax(0, 1.15fr) minmax(340px, 0.85fr)";
  const adminColumns = windowWidth < 900 ? "1fr" : "1fr 1fr 1fr";
  const archiveColumns = windowWidth < 700 ? "1fr" : "1fr 1fr";

  const selectableDates = useMemo(() => {
  const today = new Date();
  const list = [];
  const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];

  let offset = 0;

  while (list.length < 14) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    offset += 1;

    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${y}-${m}-${day}`;
    const label = `${m}/${day} (${weekdayNames[dayOfWeek]})`;

    list.push({ value, label });
  }

  return list;
}, []);

const adminSelectableDates = useMemo(() => {
  const today = new Date();
  const list = [];
  const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];

  let offset = 0;

  while (list.length < 30) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    offset += 1;

    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${y}-${m}-${day}`;
    const label = `${m}/${day} (${weekdayNames[dayOfWeek]})`;

    list.push({ value, label });
  }

  return list;
}, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
        padding: windowWidth < 700 ? "16px" : "28px",
        fontFamily: "'Pretendard', 'Noto Sans KR', Arial, sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
            borderRadius: "30px",
            padding: windowWidth < 700 ? "22px" : "30px 32px",
            boxShadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
            marginBottom: "28px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
            display: "flex",
            flexDirection: windowWidth < 700 ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: windowWidth < 700 ? "14px" : "24px",
            width: "100%",
            }}
          >
          <div
            style={{
              textAlign: "center",
              justifySelf: "center",
            }}
          >
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "6px",
                  fontWeight: "800",
                  letterSpacing: "1.2px",
                }}
              >
                SOLOHL
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: windowWidth < 700 ? "28px" : "40px",
                  fontWeight: "800",
                  color: "#0f172a",
                  lineHeight: "1.15",
                }}
              >
                {data.settings.clubName}
              </h1>
                            <p
                style={{
                  color: "#475569",
                  marginTop: "10px",
                  marginBottom: 0,
                  fontSize: windowWidth < 700 ? "14px" : "16px",
                  lineHeight: "1.7",
                  maxWidth: "560px",
                  marginLeft: 0,
                  marginRight: 0,
                }}
              >
                게스트 신청 후에는 신청 확인을 통해 신청을 확인할 수 있습니다.
              </p>
            </div>

            <img
              src="/solohlclub_logo.png"
              alt="솔올클럽 로고"
              style={{
                width: windowWidth < 700 ? "82px" : "110px",
                height: windowWidth < 700 ? "82px" : "110px",
                objectFit: "contain",
                display: "block",
                justifySelf: windowWidth < 700 ? "center" : "start",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mainColumns,
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>필독사항</h2>
              <div style={{ color: "#334155", fontSize: "15px", lineHeight: "1.9" }}>
                <div>솔올클럽을 찾아주셔서 감사합니다!</div>
                <div>• 게스트 신청은 화, 목, 금 당일 오후 12시에 선착순 5명만 오픈됩니다.</div>
                <div>• 오후 3시이후 신청 확인을 통해 게스트 신청 승인을 확인할 수 있습니다.</div>
                <div>• 게스트는 꼭 초대 멤버와 함께 동행해주신 후, 기본 규칙 지켜주시길 바랍니다.</div>
                <div>• 회원당 게스트 1인만 가능하며, 동일멤버로 게임 반복시 게스트 거절될 수 있습니다.</div>
                <div style={{ color: "#dc2626", fontWeight: "700" }}>
                  *초대회원분들은 기존 회원분들이 불편하지 않도록 신경써주시길 부탁드립니다*
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>게스트 신청</h2>

              <div style={{ display: "grid", gridTemplateColumns: formColumns, gap: "16px" }}>
                <div>
                  <label style={labelStyle}>신청 날짜</label>
                  <select
                    value={applyForm.date}
                    onChange={(e) => setApplyForm({ ...applyForm, date: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">날짜 선택</option>
                    {selectableDates.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
                    {availabilityText}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>신청자 이름</label>
                  <input
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    style={inputStyle}
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label style={labelStyle}>신청자 급수</label>
                  <input
                    value={applyForm.level}
                    onChange={(e) => setApplyForm({ ...applyForm, level: e.target.value })}
                    style={inputStyle}
                    placeholder="전국기준 : A, B, C, D, 초심"
                  />
                </div>

                <div>
                  <label style={labelStyle}>생년월일 6자리</label>
                  <input
                    value={applyForm.birth6}
                    onChange={(e) =>
                      setApplyForm({
                        ...applyForm,
                        birth6: onlyDigits(e.target.value).slice(0, 6),
                      })
                    }
                    style={inputStyle}
                    placeholder="900101"
                  />
                </div>

                <div>
                  <label style={labelStyle}>전화번호</label>
                  <input
                    value={applyForm.phone}
                    onChange={(e) =>
                      setApplyForm({
                        ...applyForm,
                        phone: onlyDigits(e.target.value).slice(0, 11),
                      })
                    }
                    style={inputStyle}
                    placeholder="01012345678"
                  />
                </div>

                <div>
                  <label style={labelStyle}>초대회원</label>
                  <input
                    value={applyForm.guestMember}
                    onChange={(e) => setApplyForm({ ...applyForm, guestMember: e.target.value })}
                    style={inputStyle}
                    placeholder="김OO"
                  />
                </div>
              </div>

              {applyMessage && (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1e3a8a",
                    fontSize: "14px",
                    lineHeight: "1.6",
                  }}
                >
                  {applyMessage}
                </div>
              )}

              <button onClick={handleApply} style={primaryButtonStyle}>
                신청하기
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>신청 확인</h2>

              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>생년월일 6자리</label>
                  <input
                    value={checkBirth6}
                    onChange={(e) => setCheckBirth6(onlyDigits(e.target.value).slice(0, 6))}
                    style={inputStyle}
                    placeholder="900101"
                  />
                </div>
                <div>
                  <label style={labelStyle}>전화번호 뒤 4자리</label>
                  <input
                    value={checkPhoneLast4}
                    onChange={(e) => setCheckPhoneLast4(onlyDigits(e.target.value).slice(0, 4))}
                    style={inputStyle}
                    placeholder="1234"
                  />
                </div>
              </div>

              <button onClick={handleCheck} style={primaryButtonStyle}>
                조회하기
              </button>

              {checkSearched && checkResults.length === 0 && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                    fontSize: "14px",
                  }}
                >
                  일치하는 신청 내역이 없습니다.
                </div>
              )}

              <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                {checkResults.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "16px",
                      padding: "16px",
                      background: "#fcfdff",
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "#0f172a" }}>
                      {formatDate(item.date)} / {item.name}
                    </div>
                    <div style={{ color: "#64748b", marginTop: "6px", fontSize: "14px" }}>
                      급수 {item.level} · 초대 멤버 {item.guestMember}
                    </div>
                    <div
                      style={{
                        marginTop: "10px",
                        fontWeight: "800",
                        color: statusColor(item.status),
                      }}
                    >
                      {statusText(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "28px", textAlign: "center" }}>
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            style={bottomAdminButtonStyle}
          >
            {showAdmin ? "관리자 닫기" : "관리자 페이지"}
          </button>
        </div>

        {showAdmin && (
          <div
            style={{
              marginTop: "20px",
              ...cardStyle,
            }}
          >
            <h2 style={sectionTitleStyle}>관리자 페이지</h2>

            {!adminLoggedIn ? (
              <div style={{ maxWidth: "360px" }}>
                <div>
                  <label style={labelStyle}>비밀번호</label>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    style={inputStyle}
                    placeholder="관리자 비밀번호"
                  />
                </div>

                {adminLoginError && (
                  <div style={{ color: "#dc2626", marginTop: "10px", fontSize: "14px" }}>
                    {adminLoginError}
                  </div>
                )}

                <button onClick={handleAdminLogin} style={primaryButtonStyle}>
                  로그인
                </button>

                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
                  비밀번호를 입력하세요.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "24px" }}>
                  <section style={adminSectionStyle}>
                    <h3 style={adminTitleStyle}>기본 신청 설정</h3>
                    <div style={{ display: "grid", gridTemplateColumns: adminColumns, gap: "16px" }}>
                      <div>
                        <label style={labelStyle}>사이트 제목</label>
                        <input
                          value={data.settings.clubName}
                          onChange={(e) =>
                            setData({
                              ...data,
                              settings: { ...data.settings, clubName: e.target.value },
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>신청 오픈 시간</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={data.settings.bookingOpenHour}
                          onChange={(e) =>
                            setData({
                              ...data,
                              settings: {
                                ...data.settings,
                                bookingOpenHour: Number(e.target.value || 12),
                              },
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>기본 하루 인원</label>
                        <input
                          type="number"
                          min="1"
                          value={data.settings.defaultCapacity}
                          onChange={(e) =>
                            setData({
                              ...data,
                              settings: {
                                ...data.settings,
                                defaultCapacity: Number(e.target.value || 5),
                              },
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </section>

                  <section style={adminSectionStyle}>
                    <h3 style={adminTitleStyle}>날짜별 신청 가능/마감 설정</h3>
                    <div style={{ display: "grid", gridTemplateColumns: adminColumns, gap: "16px" }}>
                      <div>
                        <label style={labelStyle}>날짜</label>
                        <select
                          value={dayForm.date}
                          onChange={(e) => setDayForm({ ...dayForm, date: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">날짜 선택</option>
                          {adminSelectableDates.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>하루 인원</label>
                        <input
                          type="number"
                          min="1"
                          value={dayForm.capacity}
                          onChange={(e) =>
                            setDayForm({
                              ...dayForm,
                              capacity: Number(e.target.value || 1),
                            })
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>상태</label>
                        <select
                          value={dayForm.enabled ? "open" : "closed"}
                          onChange={(e) =>
                            setDayForm({
                              ...dayForm,
                              enabled: e.target.value === "open",
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="open">신청 가능</option>
                          <option value="closed">신청 마감</option>
                        </select>
                      </div>
                    </div>

                    <button onClick={saveDaySetting} style={primaryButtonStyle}>
                      날짜 설정 저장
                    </button>

                    <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                      {data.daySettings.map((item) => (
                        <div
                          key={item.date}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "16px",
                            padding: "15px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                            background: "#fcfdff",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: "700", color: "#0f172a" }}>
                              {formatDate(item.date)}
                            </div>
                            <div style={{ color: "#64748b", marginTop: "4px", fontSize: "14px" }}>
                              {item.enabled ? "신청 가능" : "신청 마감"} · {item.capacity}명
                            </div>
                          </div>
                          <button
                            onClick={() => removeDaySetting(item.date)}
                            style={smallDangerButtonStyle}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={adminSectionStyle}>
                    <h3 style={adminTitleStyle}>이번 달 신청목록</h3>

                    <div style={{ maxWidth: "260px", marginBottom: "16px" }}>
                      <label style={labelStyle}>조회 월</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={inputStyle}
                      >
                        {monthOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gap: "16px" }}>
                      {groupByDate(currentMonthItems).map(([date, items]) => (
                        <div key={date}>
                          <div
                            style={{
                              fontWeight: "800",
                              marginBottom: "10px",
                              color: "#0f172a",
                              fontSize: "17px",
                            }}
                          >
                            {formatDate(date)} ({items.length}명)
                          </div>

                          <div style={{ display: "grid", gap: "12px" }}>
                            {items.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "18px",
                                  padding: "16px",
                                  background: "#fcfdff",
                                }}
                              >
                                <div style={{ fontWeight: "700", color: "#0f172a" }}>
                                  {item.name} / {item.level}
                                </div>
                                <div style={{ color: "#64748b", marginTop: "5px", fontSize: "14px" }}>
                                  초대 멤버 {item.guestMember}
                                </div>
                                <div style={{ color: "#64748b", marginTop: "5px", fontSize: "14px" }}>
                                  생년월일 {item.birth6} / 전화번호 {item.phone}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                    marginTop: "12px",
                                  }}
                                >
                                  <button
                                    onClick={() => updateApplicationStatus(item.id, "confirmed")}
                                    style={smallButtonStyle}
                                  >
                                    확정
                                  </button>
                                  <button
                                    onClick={() => updateApplicationStatus(item.id, "pending")}
                                    style={smallButtonStyle}
                                  >
                                    보류
                                  </button>
                                  <button
                                    onClick={() => updateApplicationStatus(item.id, "canceled")}
                                    style={smallDangerButtonStyle}
                                  >
                                    취소
                                  </button>
                                  <button
                                    onClick={() => deleteApplication(item.id)}
                                    style={smallDangerButtonStyle}
                                  >
                                    삭제
                                  </button>
                                </div>

                                <div
                                  style={{
                                    marginTop: "12px",
                                    fontWeight: "800",
                                    color: statusColor(item.status),
                                  }}
                                >
                                  현재 상태: {statusText(item.status)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {currentMonthItems.length === 0 && (
                        <div style={{ color: "#64748b" }}>표시할 신청 내역이 없습니다.</div>
                      )}
                    </div>
                  </section>

                  <section style={adminSectionStyle}>
                    <h3 style={adminTitleStyle}>지난 과거기록</h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: archiveColumns,
                        gap: "16px",
                        maxWidth: "520px",
                      }}
                    >
                      <div>
                        <label style={labelStyle}>조회할 월</label>
                        <select
                          value={archiveMonth}
                          onChange={(e) => {
                            setArchiveMonth(e.target.value);
                            setArchiveWeek("all");
                          }}
                          style={inputStyle}
                        >
                          <option value="">월 선택</option>
                          {monthOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>몇째주</label>
                        <select
                          value={archiveWeek}
                          onChange={(e) => setArchiveWeek(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="all">전체</option>
                          {archiveWeekOptions.map((w) => (
                            <option key={w} value={w}>
                              {w}째주
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                      {archiveItems.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "16px",
                            padding: "15px 16px",
                            background: "#fcfdff",
                          }}
                        >
                          <div style={{ fontWeight: "700", color: "#0f172a" }}>
                            {formatDate(item.date)} · {getWeekLabel(item.date)}
                          </div>
                          <div style={{ color: "#64748b", marginTop: "5px", fontSize: "14px" }}>
                            {item.name} / {item.level} / 초대 멤버 {item.guestMember}
                          </div>
                          <div
                            style={{
                              marginTop: "9px",
                              fontWeight: "800",
                              color: statusColor(item.status),
                            }}
                          >
                            {statusText(item.status)}
                          </div>
                        </div>
                      ))}

                      {archiveMonth && archiveItems.length === 0 && (
                        <div style={{ color: "#64748b" }}>선택한 조건의 과거 기록이 없습니다.</div>
                      )}
                    </div>
                  </section>             
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.08)",
  border: "1px solid #e5e7eb",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "22px",
  fontSize: "30px",
  color: "#0f172a",
  fontWeight: "800",
  lineHeight: "1.2",
};

const adminTitleStyle = {
  marginTop: 0,
  marginBottom: "18px",
  fontSize: "22px",
  color: "#0f172a",
  fontWeight: "800",
};

const labelStyle = {
  display: "block",
  fontSize: "14px",
  fontWeight: "700",
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #cbd5e1",
  marginTop: "8px",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "15px",
  outline: "none",
};

const primaryButtonStyle = {
  marginTop: "18px",
  width: "100%",
  padding: "15px",
  borderRadius: "14px",
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
  color: "#fff",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: "700",
  boxShadow: "0 8px 18px rgba(30, 58, 138, 0.22)",
};

const bottomAdminButtonStyle = {
  padding: "14px 24px",
  borderRadius: "14px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
};

const smallButtonStyle = {
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: "700",
};

const smallDangerButtonStyle = {
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: "700",
};

const adminSectionStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "22px",
  background: "#ffffff",
};