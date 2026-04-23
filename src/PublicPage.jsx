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
  return String(value || "").replace(/\D/g, "");
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

function toDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
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

function isWeekend(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getDateVisualState(data, date) {
  const today = getTodayLocalDateString();

  if (isWeekend(date) || date < today) return "disabled";
  if (!isDateEnabled(data, date)) return "closed";
  if (date > today) return "upcoming";
  if (!canOpenByTime(date, data.settings.bookingOpenHour)) return "upcoming";

  const cap = getCapacityForDate(data, date);
  const used = countActiveApplicationsForDate(data, date);
  if (used >= cap) return "closed";
  return "open";
}

function getAvailabilityText(data, date) {
  if (!date) return "날짜를 선택해주세요.";

  const today = getTodayLocalDateString();

  if (isWeekend(date)) return "주말은 신청 대상 날짜가 아닙니다.";
  if (date < today) return "지난 날짜는 신청할 수 없습니다.";
  if (!isDateEnabled(data, date)) return "관리자가 신청 마감으로 설정한 날짜입니다.";
  if (date > today) return "아직 활성화 전 날짜입니다.";

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

function getDateStateLabel(state) {
  if (state === "open") return "신청 가능";
  if (state === "closed") return "선택 불가";
  if (state === "upcoming") return "아직 비활성화";
  return "선택 불가";
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "999px",
          background: color,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function MonthGrid({ monthDate, selectedDate, onSelect, data }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];

  const cells = [];
  for (let i = 0; i < startDay; i += 1) {
    cells.push(<div key={`blank-${i}`} style={calendarBlankCellStyle} />);
  }

  for (let dateNum = 1; dateNum <= lastDate; dateNum += 1) {
    const dateObj = new Date(year, month, dateNum);
    const dateString = toDateString(dateObj);
    const state = getDateVisualState(data, dateString);
    const selected = selectedDate === dateString;
    const clickable = state === "open" || state === "upcoming";

    let background = "#ffffff";
    let color = "#0f172a";
    let border = "1px solid #e2e8f0";

    if (state === "open") {
      background = "#eff6ff";
      color = "#1d4ed8";
      border = "1px solid #93c5fd";
    } else if (state === "closed") {
      background = "#fef2f2";
      color = "#dc2626";
      border = "1px solid #fecaca";
    } else if (state === "upcoming") {
      background = "#f8fafc";
      color = "#64748b";
      border = "1px solid #cbd5e1";
    } else {
      background = "#f8fafc";
      color = "#94a3b8";
      border = "1px solid #e2e8f0";
    }

    if (selected) {
      border = "2px solid #0f172a";
    }

    cells.push(
      <button
        key={dateString}
        type="button"
        onClick={() => clickable && onSelect(dateString)}
        disabled={!clickable}
        title={`${formatDate(dateString)} · ${getDateStateLabel(state)}`}
        style={{
          ...calendarDateButtonStyle,
          background,
          color,
          border,
          cursor: clickable ? "pointer" : "not-allowed",
          opacity: clickable ? 1 : 0.95,
        }}
      >
        <div style={{ fontWeight: "800", fontSize: "15px" }}>{dateNum}</div>
      </button>
    );
  }

  return (
    <div style={calendarMonthCardStyle}>
      <div
        style={{
          fontSize: "18px",
          fontWeight: "800",
          color: "#0f172a",
          marginBottom: "10px",
        }}
      >
        {year}년 {month + 1}월
      </div>

      <div style={calendarWeekHeaderStyle}>
        {weekNames.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "12px",
              fontWeight: "700",
              color: "#64748b",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div style={calendarGridStyle}>{cells}</div>
    </div>
  );
}

function CalendarPicker({ value, onChange, data, monthsToShow = 1 }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = value ? new Date(value + "T00:00:00") : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!value) return;
    const selected = new Date(value + "T00:00:00");
    const selectedMonthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
    if (selectedMonthStart.getTime() !== currentMonth.getTime()) {
      setCurrentMonth(selectedMonthStart);
    }
  }, [value, currentMonth]);

  const monthDates = useMemo(() => {
    return Array.from({ length: monthsToShow }, (_, idx) => {
      return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + idx, 1);
    });
  }, [currentMonth, monthsToShow]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
          }
          style={calendarNavButtonStyle}
        >
          이전
        </button>

        <div style={{ fontSize: "14px", color: "#475569", fontWeight: "700" }}>
          날짜를 눌러 선택하세요
        </div>

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
          }
          style={calendarNavButtonStyle}
        >
          다음
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px" }}>
        {monthDates.map((monthDate) => (
          <MonthGrid
            key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
            monthDate={monthDate}
            selectedDate={value}
            onSelect={onChange}
            data={data}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 14px",
          marginTop: "12px",
          fontSize: "13px",
          color: "#475569",
        }}
      >
        <LegendDot color="#2563eb" label="활성화" />
        <LegendDot color="#ef4444" label="선택 불가" />
        <LegendDot color="#94a3b8" label="아직 활성화 전" />
      </div>
    </div>
  );
}

export default function PublicPage() {
  const [data, setData] = useState(initialData);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const [applyForm, setApplyForm] = useState({
    date: "",
    applicantName: "",
    guestName: "",
    guestLevel: "",
    phone8: "",
  });
  const [applyMessage, setApplyMessage] = useState("");

  const [checkPhone8, setCheckPhone8] = useState("");
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
        applicantName: row.name,
        guestName: row.guest_member,
        guestLevel: row.level,
        phone: row.phone,
        phone8: row.phone8 ?? row.phone_8 ?? (row.phone ? String(row.phone).slice(-8) : ""),
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

  async function handleApply() {
    const cleanPhone8 = onlyDigits(applyForm.phone8).slice(0, 8);

    if (
      !applyForm.date ||
      !applyForm.applicantName ||
      !applyForm.guestName ||
      !applyForm.guestLevel ||
      !cleanPhone8
    ) {
      setApplyMessage("모든 항목을 입력해주세요.");
      return;
    }

    if (cleanPhone8.length !== 8) {
      setApplyMessage("신청자 전화번호 8자리를 정확히 입력해주세요.");
      return;
    }

    const today = getTodayLocalDateString();

    if (applyForm.date !== today) {
      setApplyMessage("신청은 당일만 가능합니다.");
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
        app.phone8 === cleanPhone8 &&
        app.status !== "canceled"
    );

    if (duplicate) {
      setApplyMessage("이미 해당 날짜에 신청한 내역이 있습니다.");
      return;
    }

    const fullPhone = `010${cleanPhone8}`;

    const { error } = await supabase.from("guest_applications").insert([
      {
        date: applyForm.date,
        name: applyForm.applicantName,
        level: applyForm.guestLevel,
        phone: fullPhone,
        phone8: cleanPhone8,
        guest_member: applyForm.guestName,
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
      applicantName: "",
      guestName: "",
      guestLevel: "",
      phone8: "",
    });
  }

  async function handleCheck() {
    const phone8 = onlyDigits(checkPhone8).slice(0, 8);

    if (phone8.length !== 8) {
      setCheckResults([]);
      setCheckSearched(true);
      return;
    }

    const { data: rows, error } = await supabase
      .from("guest_applications")
      .select("*")
      .eq("phone8", phone8)
      .order("created_at", { ascending: false });

    if (error) {
      setCheckResults([]);
      setCheckSearched(true);
      return;
    }

    const found = (rows ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      applicantName: row.name,
      guestName: row.guest_member,
      guestLevel: row.level,
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
                게스트 신청 후에는 신청 확인을 통해 신청 상태를 조회할 수 있습니다.
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
                <div>• 오후 3시 이후 신청 확인을 통해 게스트 신청 승인을 확인할 수 있습니다.</div>
                <div>• 게스트는 꼭 초대 멤버와 함께 동행해주신 후, 기본 규칙 지켜주시길 바랍니다.</div>
                <div>• 회원당 게스트 1인만 가능하며, 동일멤버로 게임 반복시 게스트 거절될 수 있습니다.</div>
                <div style={{ color: "#dc2626", fontWeight: "700" }}>
                  *초대회원분들은 기존 회원분들이 불편하지 않도록 신경써주시길 부탁드립니다*
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>게스트 신청</h2>

              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>신청 날짜</label>
                  <div style={{ marginTop: "8px" }}>
                    <CalendarPicker
                      value={applyForm.date}
                      onChange={(date) => setApplyForm({ ...applyForm, date })}
                      data={data}
                      monthsToShow={1}
                    />
                  </div>

                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
                    {availabilityText}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: formColumns, gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>신청자 이름</label>
                    <input
                      value={applyForm.applicantName}
                      onChange={(e) =>
                        setApplyForm({ ...applyForm, applicantName: e.target.value })
                      }
                      style={inputStyle}
                      placeholder="홍길동"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>게스트 이름</label>
                    <input
                      value={applyForm.guestName}
                      onChange={(e) =>
                        setApplyForm({ ...applyForm, guestName: e.target.value })
                      }
                      style={inputStyle}
                      placeholder="김OO"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>게스트 급수</label>
                    <input
                      value={applyForm.guestLevel}
                      onChange={(e) =>
                        setApplyForm({ ...applyForm, guestLevel: e.target.value })
                      }
                      style={inputStyle}
                      placeholder="시군기준 : A, B, C, D, 초심"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>신청자 전화번호 8자리</label>
                    <input
                      value={applyForm.phone8}
                      onChange={(e) =>
                        setApplyForm({
                          ...applyForm,
                          phone8: onlyDigits(e.target.value).slice(0, 8),
                        })
                      }
                      style={inputStyle}
                      placeholder="12345678"
                    />
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                      010 제외 8자리만 입력
                    </div>
                  </div>
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
                  <label style={labelStyle}>신청자 전화번호 8자리</label>
                  <input
                    value={checkPhone8}
                    onChange={(e) => setCheckPhone8(onlyDigits(e.target.value).slice(0, 8))}
                    style={inputStyle}
                    placeholder="12345678"
                  />
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                    010 제외 8자리 입력
                  </div>
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
                      {formatDate(item.date)} / {item.applicantName}
                    </div>
                    <div style={{ color: "#64748b", marginTop: "6px", fontSize: "14px" }}>
                      게스트 {item.guestName} · 급수 {item.guestLevel}
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

const calendarNavButtonStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: "700",
};

const calendarMonthCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "14px",
  background: "#ffffff",
};

const calendarWeekHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "6px",
  marginBottom: "8px",
};

const calendarGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "6px",
};

const calendarBlankCellStyle = {
  minHeight: "66px",
};

const calendarDateButtonStyle = {
  minHeight: "66px",
  borderRadius: "12px",
  padding: "8px 4px",
  background: "#ffffff",
};