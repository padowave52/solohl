import { supabase } from "./supabase";
import React, { useEffect, useMemo, useState } from "react";

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

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatDateTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
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

export default function AdminPage() {
  const [data, setData] = useState(initialData);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const [adminLoggedIn, setAdminLoggedIn] = useState(
    localStorage.getItem(ADMIN_SESSION_KEY) === "logged-in"
  );
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [selectedDay, setSelectedDay] = useState("all");
  const [archiveMonth, setArchiveMonth] = useState("");
  const [archiveWeek, setArchiveWeek] = useState("all");

  const [dayForm, setDayForm] = useState({
    date: "",
    enabled: true,
    capacity: 5,
  });

  async function fetchAdminData() {
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
        guestMember: row.guest_member,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  }

  useEffect(() => {
    fetchAdminData();
  }, []);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    .filter((a) => selectedDay === "all" || a.date.slice(8, 10) === selectedDay)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    }, [data, selectedMonth, selectedDay]);

  const currentMonthDayOptions = useMemo(() => {
  return [
    ...new Set(
      data.applications
        .filter((a) => getMonthKey(a.date) === selectedMonth)
        .map((a) => a.date.slice(8, 10))
    ),
        ].sort((a, b) => Number(a) - Number(b));
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

  const topApplicants = useMemo(() => {
    const counts = {};

    data.applications.forEach((item) => {
        const key = `${item.name} (${item.birth6})`;
        counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
}, [data]);

const topGuestMembers = useMemo(() => {
  const counts = {};

  data.applications.forEach((item) => {
    const key = item.guestMember || "미입력";
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}, [data]);

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

  async function updateApplicationStatus(id, status) {
    await supabase.from("guest_applications").update({ status }).eq("id", id);
    await fetchAdminData();
  }

  async function deleteApplication(id) {
    await supabase.from("guest_applications").delete().eq("id", id);
    await fetchAdminData();
  }

  async function saveDaySetting() {
    if (!dayForm.date) return;

    await supabase.from("day_settings").upsert({
      date: dayForm.date,
      enabled: dayForm.enabled,
      capacity: Number(dayForm.capacity),
    });

    await fetchAdminData();

    setDayForm({
      date: "",
      enabled: true,
      capacity: Number(data.settings.defaultCapacity),
    });
  }

  async function removeDaySetting(date) {
    await supabase.from("day_settings").delete().eq("date", date);
    await fetchAdminData();
  }

  async function saveSiteSettings() {
    await supabase.from("site_settings").upsert({
      id: 1,
      club_name: data.settings.clubName,
      booking_open_hour: Number(data.settings.bookingOpenHour),
      default_capacity: Number(data.settings.defaultCapacity),
    });

    await fetchAdminData();
  }

  function groupByDate(items) {
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });
    return Object.entries(grouped);
  }

  const adminColumns = windowWidth < 900 ? "1fr" : "1fr 1fr 1fr";
  const archiveColumns = windowWidth < 700 ? "1fr" : "1fr 1fr";

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
        <div style={{ marginBottom: "20px" }}>
          <a href="#/" style={smallButtonStyle}>
            신청 페이지로 돌아가기
          </a>
        </div>

        <div style={cardStyle}>
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

                  <button onClick={saveSiteSettings} style={primaryButtonStyle}>
                    기본 설정 저장
                  </button>
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

                  <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: windowWidth < 700 ? "1fr" : "260px 180px",
                        gap: "16px",
                        marginBottom: "16px",
                        alignItems: "end",
                    }}
                    >
                        <div>
                            <label style={labelStyle}>조회 연도-월</label>
                            <select
                            value={selectedMonth}
                            onChange={(e) => {
                                setSelectedMonth(e.target.value);
                                setSelectedDay("all");
                            }}
                            style={inputStyle}
                            >
                            {monthOptions.map((m) => (
                                <option key={m} value={m}>
                                {m}
                                </option>
                            ))}
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>조회 일</label>
                            <select
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            style={inputStyle}
                            >
                            <option value="all">전체</option>
                            {currentMonthDayOptions.map((day) => (
                                <option key={day} value={day}>
                                {day}일
                                </option>
                            ))}
                            </select>
                        </div>
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

                              <div style={{ color: "#64748b", marginTop: "5px", fontSize: "14px" }}>
                                신청 시각 {formatDateTime(item.createdAt)}
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
                                  승인
                                </button>
                                <button
                                  onClick={() => updateApplicationStatus(item.id, "pending")}
                                  style={smallButtonStyle}
                                >
                                  승인대기
                                </button>
                                <button
                                  onClick={() => updateApplicationStatus(item.id, "canceled")}
                                  style={smallDangerButtonStyle}
                                >
                                  선착마감
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

                <section style={adminSectionStyle}>
                    <h3 style={adminTitleStyle}>신청 통계 Top 5</h3>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: windowWidth < 900 ? "1fr" : "1fr 1fr",
                            gap: "16px",
                        }}
                    >
                        <div
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "16px",
                                padding: "16px",
                                background: "#fcfdff",
                            }}
                        >
                            <div style={{ fontWeight: "800", marginBottom: "10px", color: "#0f172a" }}>
                                가장 많이 신청한 사람 Top 5
                            </div>
                            <div style={{ display: "grid", gap: "8px" }}>
                                {topApplicants.length === 0 ? (
                                    <div style={{ color: "#64748b" }}>데이터가 없습니다.</div>
                                ) : (
                                    topApplicants.map(([name, count], index) => (
                                        <div key={name} style={{ color: "#334155", fontSize: "14px" }}>
                                            {index + 1}. {name} - {count}회
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "16px",
                                padding: "16px",
                                background: "#fcfdff",
                            }}
                        >
                            <div style={{ fontWeight: "800", marginBottom: "10px", color: "#0f172a" }}>
                                초대회원 Top 5
                            </div>
                            <div style={{ display: "grid", gap: "8px" }}>
                                {topGuestMembers.length === 0 ? (
                                    <div style={{ color: "#64748b" }}>데이터가 없습니다.</div>
                                ) : (
                                    topGuestMembers.map(([name, count], index) => (
                                        <div key={name} style={{ color: "#334155", fontSize: "14px" }}>
                                            {index + 1}. {name} - {count}회
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <button onClick={handleAdminLogout} style={smallDangerButtonStyle}>
                    로그아웃
                  </button>
                </div>
              </div>
            </>
          )}
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

const smallButtonStyle = {
  display: "inline-block",
  textDecoration: "none",
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