import { supabase } from "./supabase";
import React, { useEffect, useMemo, useState } from "react";
import logo from "./assets/solohlclub_logo.png";

const initialData = {
  settings: {
    clubName: "솔올클럽 게스트 신청",
    bookingOpenHour: 12,
    defaultCapacity: 5,
  },
  daySettings: [],
  applications: [],
};

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
  if (status === "confirmed") return "승인";
  if (status === "canceled") return "선착마감";
  return "승인대기";
}

function statusColor(status) {
  if (status === "confirmed") return "#15803d";
  if (status === "canceled") return "#dc2626";
  return "#b45309";
}

export default function PublicPage() {
  const [data, setData] = useState(initialData);
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

  async function fetchPublicData() {
    const { data: settingsRow } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const { data: daySettingsRows } = await supabase
      .from("day_settings")
      .select("*")
      .order("date", { ascending: true });

    const { data: applicationRows } = await supabase
      .from("guest_applications")
      .select("*")
      .order("created_at", { ascending: false });

    setData({
      settings: {
        clubName: settingsRow?.club_name ?? initialData.settings.clubName,
        bookingOpenHour:
          settingsRow?.booking_open_hour ?? initialData.settings.bookingOpenHour,
        defaultCapacity:
          settingsRow?.default_capacity ?? initialData.settings.defaultCapacity,
      },
      daySettings: (daySettingsRows ?? []).map((row) => ({
        date: row.date,
        enabled: row.enabled,
        capacity: row.capacity,
      })),
      applications: (applicationRows ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        name: row.name,
        level: row.level,
        birth6: row.birth6,
        phone: row.phone,
        phoneLast4: row.phone_last4,
        guestMember: row.guest_member,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  }

  useEffect(() => {
    fetchPublicData();
  }, []);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const availabilityText = useMemo(() => {
    return getAvailabilityText(data, applyForm.date);
  }, [data, applyForm.date]);

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

  async function handleApply() {
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
      setApplyMessage(
        `해당 날짜 신청은 ${data.settings.bookingOpenHour}:00부터 가능합니다.`
      );
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

    const { error } = await supabase.from("guest_applications").insert([
      {
        date: applyForm.date,
        name: applyForm.name,
        level: applyForm.level,
        birth6: cleanBirth6,
        phone: cleanPhone,
        phone_last4: cleanPhone.slice(-4),
        guest_member: applyForm.guestMember,
        status: "pending",
      },
    ]);

    if (error) {
      setApplyMessage("신청 저장 중 오류가 발생했습니다.");
      return;
    }

    await fetchPublicData();

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

  async function handleCheck() {
    const b = onlyDigits(checkBirth6).slice(0, 6);
    const p = onlyDigits(checkPhoneLast4).slice(0, 4);

    const { data: rows, error } = await supabase
      .from("guest_applications")
      .select("*")
      .eq("birth6", b)
      .eq("phone_last4", p)
      .order("created_at", { ascending: false });

    if (error) {
      setCheckResults([]);
      setCheckSearched(true);
      return;
    }

    const found = (rows ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      level: row.level,
      guestMember: row.guest_member,
      status: row.status,
    }));

    setCheckResults(found);
    setCheckSearched(true);
  }

  const formColumns = windowWidth < 900 ? "1fr" : "1fr 1fr";
  const mainColumns =
    windowWidth < 1100 ? "1fr" : "minmax(0, 1.15fr) minmax(340px, 0.85fr)";

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
            <div style={{ textAlign: "center" }}>
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
                }}
              >
                게스트 신청 후에는 신청 확인을 통해 신청을 확인할 수 있습니다.
              </p>
            </div>

            <img
              src={logo}
              alt="솔올클럽 로고"
              style={{
                width: windowWidth < 700 ? "82px" : "110px",
                height: windowWidth < 700 ? "82px" : "110px",
                objectFit: "contain",
                display: "block",
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
                    placeholder="시군기준 : A, B, C, D, 초심"
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
          <a href="#/admin" style={bottomAdminButtonStyle}>
            관리자 페이지
          </a>
        </div>
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
  display: "inline-block",
  textDecoration: "none",
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