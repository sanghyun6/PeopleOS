# PeopleOS 심사 전략

작성: 2026-10-25 02:00 PT. 기준 커밋 `bf937c5`. 코드는 읽기만 했고 수정하지 않았습니다.
확인 방법: `convex/`, `agent/`, `app/`, `components/`, `scripts/`, `docs/PIPELINE.md`를 직접 읽음. `npm test` 9개 파일 122개 테스트 통과(02:00 PT 재실행).
라이브 배포(Cartesia 대시보드, 전화번호, Moss 터널)는 이 문서 작성 중에 호출하지 않았습니다. 그 상태는 `docs/PIPELINE.md`(01:00 PT 점검) 기준입니다.

---

## 1. 포지셔닝: "Cal Hacks 앱"이 아니라 "행사장 운영 엔진"

### 한 줄
> **"PeopleOS turns a phone call into a dispatched, routed, tracked task on a live map of the venue. Cal Hacks is the first venue we loaded, not the thing we built."**

이 문장을 지탱하는 근거는 **코드 구조**입니다. "어디서나 돈다"가 아니라 **"행사장은 데이터이고, 엔진은 그 데이터를 모른다"**를 주장하세요. 이건 사실이고 증명할 수 있습니다.

### 써도 되는 주장 (코드로 확인함)

| 주장 | 근거 |
|---|---|
| 배정·경로·우회·중복판정·응급 규칙 엔진에는 행사장 이름이 없다 | `convex/lib/graph.ts`, `convex/lib/dispatch.ts`, `convex/dispatch.ts`, `convex/blockages.ts`, `convex/dedup.ts`, `convex/lib/emergency.ts`, `convex/assignments.ts`에 Cal Hacks/Palace 관련 상수 없음(grep 확인). 예외는 아래 "주의" 참고 |
| 에이전트가 말할 수 있는 위치 목록, 프롬프트 속 위치 안내, 도구 스키마, Moss 검색 문서가 **한 소스에서 생성**된다 | `buildLocations()`(`convex/lib/zoning.ts`)가 `locations` 테이블 seed(`convex/seed.ts`), 위치 어휘(`agent/vocabulary.ts`), venue guide(`agent/venue-guide.ts`), 시스템 프롬프트(`agent/prompt.ts` → `agent/export.ts`), Moss 문서(`buildMossDocuments`, `agent/venue-search.ts`)를 모두 만든다. 그래서 에이전트가 말한 위치는 항상 DB에서 찾아진다 |
| 행사장 하나 = 지오메트리 JSON + 구역/통로 표 + 직원 명단 + FAQ | `data/palace-venue.json`, `ZONES`/`EDGES`/`ROOMS`(`convex/lib/zoning.ts`, 18 zones, 27 edges), `STAFF`(`convex/seed.ts`), `agent/event-kb.json` + `agent/event-facts.md` |
| 배정은 직선이 아니라 걷는 경로 기준 | `routesFrom`(Dijkstra, `convex/lib/graph.ts`). 계단은 15 m 가산(`STAIR_PENALTY_M`), 문/계단 경유점으로 벽을 통과하지 않음(`edgeGeometry`) |
| 통로가 막히면 진행 중인 **모든** 배정을 다시 계산하고, 더 나은 사람이 있으면 재배정한다 | `applyBlockage` → `rerouteAll` → `planReroute`. 현재 담당자는 자기 작업을 뺀 업무량으로 경쟁하므로 그래프가 그대로면 절대 재배정 안 함 |
| 막힘 적용과 재배정이 **한 트랜잭션**에서 일어난다 | `insertReport`(Convex mutation) 안에서 `applyBlockage`가 edge 패치 + `rerouteAll`까지 수행 |
| 응급은 AI가 배정하지 않고 사람에게 넘긴다. 이중 방어 | 프롬프트("Emergencies come first") + 서버 `detectEmergency`(키워드, 부정문도 응급 처리) → `escalated`, 배정 없음, 중복 병합 제외(`prepareReport`) |
| 위치를 못 찾아도 응급 신고는 버려지지 않는다 | `escalateToHuman`: 위치 실패 시 `zone:box-office`로 재시도 |
| AI가 늦거나 죽어도 전화는 끊기지 않는다 | 중복판정 4 s 상한 후 휴리스틱(`DEDUP_TOTAL_MS`), Moss 2 s 후 키워드 검색(`MOSS_TIMEOUT_MS`), 브리프는 통화 밖 scheduler(`ctx.scheduler.runAfter(0, ...)`) |
| 발신자 개인정보를 묻지 않는다 | 프롬프트: "Do not ask for the caller's name or phone number." |
| 신고 파이프라인은 채널을 가리지 않는다 | `reportArgs.source`가 `voice/sms/web/manual`, `runReport` 하나를 `createFromReport`(전화)와 `reportFromWeb`(웹)이 공유. **단, 웹 화면은 없음** |
| 데모 시나리오 자체가 테스트로 고정돼 있다 | `convex/lib/dispatch.test.ts` "demo scenario": Priya 83.5 m(Broadway #1 경유) → Broadway #1 막힘 → Jordan 88.3 m(메자닌 계단 경유)로 재배정 |
| 운영자는 언제든 되돌릴 수 있다 | `/ops` 배너 Undo → `blockages.undo`가 그 막힘이 닫은 edge만 다시 열고 재계산 |

### 쓰면 안 되는 주장 (과장 또는 거짓)

| 하면 안 되는 말 | 사실 | 대신 이렇게 |
|---|---|---|
| "어떤 행사장이든 바로 돌아간다" / "plug and play" | 구역 중심 좌표, 통로, 경유점은 **손으로** 그렸다(`ZONES`, `EDGES`). 프롬프트 첫 줄, 실패 안내, 응급 fallback 위치, Moss 인덱스 이름, Cartesia 인사말에 Cal Hacks/Box Office가 하드코딩 | "새 행사장은 코드 재작성이 아니라 **데이터 작업**이다. 지금은 구역 그래프를 손으로 그리고, 자동화가 다음 단계다" |
| "직원 실시간 위치 추적" | 직원 위치는 구역 단위, 작업 완료 시에만 갱신(`assignments.complete`) | "zone-level presence, updated when a task completes" |
| "운영자가 확인하면 막힘이 적용된다" | 즉시 적용, 확인 단계 없음. `pending_review` 상태는 스키마에만 있고 미사용. CLAUDE.md 데모 대본의 "operator confirms"와 다름 | "applied instantly, one-click Undo for the operator" |
| "Claude가 중복을 판정한다" | 중복판정은 Bitdeer(bge-m3 + DeepSeek). Claude 호출 없음. `convex/lib/dedup.ts` 주석과 CLAUDE.md는 옛 설계라 틀림 | Claude = 전화 에이전트의 두뇌. 중복판정 = Bitdeer |
| "AI가 배정한다" | 배정은 결정론적 알고리즘(역할 → 가용 → 업무량 → 거리) | 오히려 강점: "**AI는 듣고, 배정은 설명 가능한 규칙이 한다**" |
| "직원에게 푸시/문자 알림" | 열려 있는 웹 페이지에서 비프 + 진동. 소리는 한 번 탭해야 나옴, iOS는 진동 미지원 | "staff web page buzzes on new assignment" |
| "응급 시 운영 리더 폰이 울린다" | `escalated`는 대시보드 빨간 마커뿐. Alex(ops_lead)에게 배정·알림 없음 | "escalations land red on the ops dashboard for a human" |
| "응답 없으면 자동 재배정" | 타임아웃 재배정 없음. decline 시에만 다음 후보 | "decline re-dispatches instantly; timeout re-dispatch is next" |
| "전화가 안 되면 웹/문자로 신고" | 백엔드 action만 있고 화면 없음 | 만들기 전엔 말하지 말 것 |
| "Moss로 위치를 찾는다" | 위치 해석은 Convex 규칙 + search index(`resolveLocation`). Moss는 **행사 Q&A**(`venue_search`) 전용. `/ops`의 "Location lookup (Moss)" 라벨이 틀렸음 | "Moss answers event questions on the call (schedule, showers, wifi rules)" |
| "중복을 N% 줄였다", "응답 시간 N분 단축" | 측정 데이터 없음 | 숫자 대신 데모에서 report count 1 → 2를 보여줄 것 |
| "수천 명 규모 검증" | 부하 테스트 없음 | 말하지 말 것 |

### Slack 근거에 대해
CLAUDE.md의 Slack 사례(콘센트 신고 무응답, 컵 질문 약 3시간, 유선 인터넷 76분, 조명 위치 확인 메시지 4번)는 **코드가 아니라 네가 모은 자료**입니다. 이 문서는 검증하지 못했습니다. 발표에 쓰려면 스크린샷을 폰에 띄워 둘 수 있을 때만 쓰세요. 그리고 기존 경기장 문자 신고 시스템(GuestAssist 등)이 있다는 점을 먼저 인정하는 게 "독창성" 질문에 더 강합니다.

---

## 2. 2분 발표 대본

### 준비 상태 (심사위원이 올 때마다)
- 노트북: `/demo` 전체 화면(왼쪽 `/ops` 3D, 오른쪽 Priya·Jordan 폰).
- 폰: PeopleOS 번호 다이얼 준비, 스피커 모드.
- 데이터: 직전에 `npm run reseed`(아래 5장 리셋 절차). **매 심사위원마다 리셋 필수**: complete가 Jordan 위치를 옮기고, 막힘은 Undo 전까지 남는다.
- 전화 문구는 아래 그대로. 특히 2번 통화는 **"Broadway 1 hallway"**라고 말할 것. "Gate 3"이라고 하면 `gate-3-4` 구역(다른 구역)이 막혀서 Priya 경로가 안 끊기고 재배정 장면이 안 나옵니다.

### 대본 (영어, 시간은 누적)

| 시간 | 말 | 화면 / 행동 |
|---|---|---|
| **0:00–0:10** | "Last night a hacker reported a dead outlet in Slack and got no reply. Here's the same report with PeopleOS. I'm calling our AI line now." | `/demo` 화면. 바로 다이얼 |
| **0:10–0:40** | (통화) **"Hi, the outlet at table 142 isn't working."** → 에이전트: "Table 142 on the main floor, right?" → **"Yes."** → 에이전트가 Priya 배정을 말함 | 3D에 마커, Priya 폰 카드 등장, 경로 선(Broadway #2 → Broadway #1 → Atrium). 손가락으로 경로를 짚으며: "It picked Priya, facilities, by walking distance, not straight line. 83 meters through this hallway." |
| **0:40–1:05** | "Now someone blocks that hallway." (통화) **"The Broadway 1 hallway is blocked by carts."** → 확인 → "Yes." | 상단 배너 "Path blocked: Broadway #1. 1 task rerouted". Priya 카드 사라지고 Jordan 폰에 새 카드. 경로가 메자닌 계단으로 바뀜. "**This is why the map is 3D.** The engine re-planned every open task in one transaction. Jordan comes down the mezzanine stairs instead." |
| **1:05–1:15** | "Jordan accepts, fixes it, done." | Jordan 폰 Accept → Complete. 마커 초록, 상단 "Avg time to acknowledge" 숫자 표시 |
| **1:15–1:35** | "Two things I care about. First: emergencies. If you say someone fainted, the AI never dispatches. It alerts a human and tells you to call 911. That's enforced on the server too, not just the prompt. Second: duplicates. A second call about the same outlet becomes report count two, not a second task. Bitdeer embeddings plus a judge model decide that, with a 4-second cap so the caller never waits." | 말로만. 시간 남으면 응급/중복은 Q&A에서 시연 |
| **1:35–2:00** | "And none of the dispatch engine knows this is Cal Hacks. The venue is one geometry file and a small zone graph; the agent's location list, its prompt and the Moss search index are all generated from it. Cartesia handles the voice, Convex keeps the phones and map live, Bitdeer judges duplicates, Moss answers event questions. **Every call changes the venue.** Want to try calling it?" | 마지막에 폰을 심사위원에게 내밀기 |

시간이 빡빡하면 0:10–0:40 통화가 30초를 넘기기 쉽습니다. 연습해서 실제 통화 시간을 재고, 넘치면 1:15–1:35 단락을 반으로 줄이세요. 데모가 먼저, 설명은 나중입니다.

### Q&A 때 꺼낼 추가 시연 (심사위원 관심에 맞춰 하나만)
- **중복**(Bitdeer 심사위원): 리셋 전 같은 사건이 아직 열려 있을 때 "Table 142 has no power" → 에이전트 "already reported", 상세 패널 Reports 2. 주의: 사건을 Complete한 뒤에는 중복이 안 됩니다(resolved는 후보 제외). 중복을 보여주려면 Complete 전에 하세요.
- **응급**(Cartesia, People-First, Anthropic): "Someone fainted at table 50" → 빨간 마커, 배정 없음, 상세에 "Emergency rule: fainted", 에이전트가 911 안내.
- **행사 Q&A**(Moss): "When is lunch?" / "Where are the showers?" → `/ops`의 Moss 숫자가 올라감. **`scripts/demo-up.sh --check`가 통과한 상태에서만.** 실패 상태면 키워드 fallback이 답하고 Moss 트랙 근거가 안 됩니다.
- **길 안내**: "How do I get from table 142 to the Box Office?"

---

## 3. 예상 질문 8개와 답

**Q1. 다른 행사장에서 쓰려면 뭘 해야 하나요?**
> "It's a data job, not a rewrite. You need four inputs: the venue geometry (tables, booths, rooms, entrances, same JSON shape as ours), a zone graph, which for this building is 18 zones and 27 walkable connections in about 60 lines, a staff roster with roles, and an FAQ file. From those, a script regenerates the agent's location vocabulary, its prompt, the tool schemas and the search index, and the seed loads the database. The dispatch, routing, dedup and emergency code doesn't change. Honestly, today the zone graph is drawn by hand and a few strings still say Cal Hacks; generating zones from a floor plan is the next step."

근거: `convex/lib/zoning.ts`, `agent/export.ts`, `convex/seed.ts`. 하드코딩: `agent/prompt.ts` 첫 줄, `convex/cartesia.ts`의 `ESCALATION_FALLBACK_LOCATION`과 500 메시지, `MOSS_INDEX_NAME`, `agent/setup-cartesia.mjs`의 인사말·keyterms.

**Q2. 왜 전화예요? 앱이면 되잖아요?**
> "The people reporting are the long tail: a thousand hackers, mentors, sponsors, venue staff, nobody installs an app for a weekend. Everyone already has a phone dialer. Voice also does something a form can't: it asks the follow-up. In Slack it took four messages to pin down where a light was out; the agent does it in one confirmation question against a fixed list of 406 real locations. And when the problem is the wifi, a cellular voice call still works. The staff side is an app, a web page, because staff are few and known."

주의: "wifi가 죽어도 된다"는 발신자 쪽 셀룰러 음성 얘기입니다. 대시보드와 직원 페이지는 인터넷이 필요합니다. 물으면 그렇게 답하세요.

**Q3. 중복 판정에 LLM이 꼭 필요한가요?**
> "Not for the easy case, and we don't use it there. A cheap filter runs first: same zone, same category, last 15 minutes, from a database index. If Bitdeer is down, the fallback is 'same table or booth means same problem', and that catches the obvious repeats. The model is for the cases that rule gets wrong. 'The Fountain is out of cups' and 'no cups at the water station by Gate 4' are the same problem at two different location names. 'Outlet dead at 142' and 'need an extension cord at 142' are the same table, same category, but different jobs. Embeddings rank candidates, nothing below 0.55 similarity ever reaches the chat model, only the top one is judged, and the whole thing is capped at 4 seconds. We haven't measured accuracy at scale; that's honest."

근거: `findDedupCandidates`, `filterDedupCandidates`(`DEDUP_WINDOW_MS`), `judgeDuplicateWithBitdeer`(`SIMILARITY_THRESHOLD = 0.55`), `sameLocationDuplicate`, `DEDUP_TOTAL_MS = 4000`. 두 예시는 구조상 그렇게 동작해야 한다는 설명이고, 실제로 그 문장 쌍을 돌려 본 기록은 없습니다. 시간 되면 한 번 돌려 보고 말하세요.

**Q4. 직원이 응답을 안 하면요?**
> "Decline re-dispatches instantly to the next-best person, and the one who declined is excluded for that incident. If nobody eligible is left, it escalates to a human. What we don't have yet is a timeout: an unanswered offer stays offered, and the operator sees it on the dashboard. With Convex's scheduler that's a small addition, but I didn't want to demo something half-built."

근거: `assignments.decline` → `dispatchToBest`, `declinedFor`. 타임아웃 없음은 `docs/PIPELINE.md` U2.

**Q5. AI가 위치를 잘못 알아들으면?**
> "The agent can only pick from a fixed vocabulary generated from the venue data, and it confirms once out loud. On the server, the resolver tries exact key, table number, label, alias, booth name, then full-text search, and if a phrase matches places in two different zones it refuses and returns unknown_location so the agent asks again. After two failed tries the agent escalates to a person."

근거: `resolveLocation`의 `pickOne`(zone이 둘 이상이면 null), 프롬프트 "still cannot pin down the location after two tries".

**Q6. 응급 판정이 틀리면요? 책임 문제는?**
> "We designed it to fail loud. It's checked twice: the prompt tells the agent to escalate, and the server independently scans for injury, fire and safety keywords and refuses to auto-dispatch. Even 'nobody is hurt' escalates, on purpose: a false alarm costs an operator a glance, a miss costs far more. The agent always tells the caller to call 911 if a life is in danger. It's a triage line, not a replacement for 911. One gap: escalations show up red on the dashboard but don't page the ops lead's phone yet."

근거: `convex/lib/emergency.ts` 주석("Negations ... still escalate"), `insertReport`, `escalateToHuman` 응답 문구.

**Q7. 직원 위치는 어떻게 알아요?**
> "At zone level, not GPS. GPS doesn't work well indoors anyway. A staff member's position updates to the incident's zone when they complete a task, and dispatch uses walking distance through the zone graph from there. Real indoor positioning, or staff tapping 'I'm at X', would plug into the same field."

근거: `staff.zoneId`, `assignments.complete`가 `zoneId: incident.zoneId`로 패치.

**Q8. 결국 티켓 시스템에 음성 붙인 거 아닌가요? 뭐가 기술적으로 어렵나요?**
> "Three things. One: the graph is live. A blockage report closes edges and re-plans every open task, with workload accounting so two incidents don't both grab the same newly-free person, all inside one database transaction, and the phones and map update by subscription. Two: every AI call is bounded and has a non-AI fallback, because a voice caller is waiting. Three: one source of truth. The prompt, the tool schema, the location table and the search index are generated from the venue data, so the agent can't name a place the database can't resolve. And there are 122 unit tests, including this exact demo scenario."

근거: `planReroute`(workloads 갱신), `insertReport`+`applyBlockage`, `agent/export.ts`, `npm test`.

---

## 4. 트랙별 강조점과 코드 근거

> 트랙 이름과 개수 제한은 Devpost에서 다시 확인하세요. 아래는 네가 적은 목록 기준입니다.

### Cartesia: "음성이 유일한 신고 채널이고, 도구 5개가 실제 시스템을 움직인다"
- **Managed Agents API로 전체를 코드로 구성**: `agent/setup-cartesia.mjs`가 `POST /v1/agents/tools`(도구 5개 등록), `POST /v1/agents`(Claude 모델 선택, `max_output_tokens`, STT `keyterms`("mezzanine", "Broadway", "atrium"), `noise_suppression`, `end_call` 시스템 도구, 타임존), 전화번호 provision/연결(`/agents/phone-numbers`)까지 수행.
- **웹훅 도구**: `agent/tools.ts`의 `TOOLS`(create_incident, report_blockage, escalate_to_human, get_directions, venue_search)와 `toCartesiaWebhookTool`(`execution_mode: "immediate"`, `response_timeout_secs: 15`, bearer 인증, `call_id`를 `{{system__conversation_id}}`에서 채우고 모델에는 숨김).
- **서버 쪽 계약**: `convex/cartesia.ts`의 `toolHandler`(인증 → `parseToolCall` → 항상 200 + 말할 `message`), `normalizeEnum`으로 LLM이 "Lost & Found"/"HIGH"를 보내도 실패하지 않음.
- **책임 있는 설계(심사 25%)**: 응급 이중 방어, 911 안내, 이름·번호 미수집, 위치 확인 질문 정확히 1회, 위치 발명 금지(프롬프트 + `unknown_location`).
- 확인 필요: 실제 등록된 모델이 Claude인지, 도구 URL/시크릿이 현재 배포와 같은지는 Cartesia 대시보드에서 확인(`docs/PIPELINE.md` U1). 실제 전화 한 통이 유일한 검증입니다.

### Convex: "DB + 실시간 + HTTP + 스케줄러가 한 곳에서, 재배정이 원자적으로"
- **HTTP 라우트**: `convex/http.ts` (`/health` + `/cartesia/*` 5개).
- **트랜잭션**: `insertReport`(mutation) 안에서 incident insert → `applyBlockage`(edge 패치) → `rerouteAll`(배정 supersede/insert, 직원 상태 동기화)까지 한 번에. 중간 상태가 화면에 보일 수 없음.
- **실시간 구독**: `/demo`에서 대시보드와 직원 폰 2개가 같은 query(`incidents.listActive`, `assignments.listActive`, `assignments.forStaff`)를 구독. accept 한 번에 세 화면이 동시에 바뀜.
- **Scheduler**: `ctx.scheduler.runAfter(0, internal.bitdeer.generateBrief)`로 LLM 호출을 통화 경로 밖으로.
- **Action ↔ query/mutation 분리**: `createFromReport`(internalAction, 외부 Bitdeer 호출) → `prepareReport`(query) → `recordDuplicate`/`insertReport`(mutation).
- **인덱스와 검색 인덱스**: `by_zone_category`(중복 후보), `by_staff_status`, `searchIndex("search_text")`(위치 해석 최후 단계).
- **관측성**: `retrievals`, `bitdeerCalls` 테이블과 `/ops` 지표.

### Moss: "통화 중 행사 질문에 2초 안에 답한다"
- **인덱스 구축**: `scripts/moss-index.ts`(`createIndex`, 있으면 `addDocs({upsert:true})` + 사라진 id `deleteDocs`로 무중단 갱신). 문서는 `buildMossDocuments`(`agent/venue-search.ts`): 행사 사실 24개(`agent/event-kb.json`) + 구역 안내 18줄.
- **검색**: `scripts/moss-server.ts`(`loadIndex` 1회, warm-up 쿼리, `query(topK: 3, alpha: 0.5)` 하이브리드로 "Gate 4" 같은 고유명사도 매칭).
- **통화 경로**: `convex/moss.ts` `search` → `convex/cartesia.ts` `venueSearch`(2 s 상한, 실패 시 키워드 fallback, `retrievals`에 found/no_match/fallback + 지연시간 기록).
- **시간 민감 정보**: `buildMessage`가 식사·샤워 등에 "as of" 시각을 붙임(`TIME_SENSITIVE_IDS`).
- 약점과 정직한 설명: Moss SDK의 임베딩 모델이 Convex action 안에서 안 떠서 노트북 서버 + 터널을 씀. 심사 직전 `scripts/demo-up.sh`로 `MOSS OK` 확인 필수. `/ops` 라벨 "Location lookup (Moss)"는 사실과 다르니 고치거나, 못 고치면 말로 바로잡을 것.

### Bitdeer: "두 모델, 두 작업, 하나는 통화 중 핵심 경로"
- **클라이언트**: `createBitdeerClient`(`convex/lib/bitdeer.ts`): 모든 요청이 하나의 deadline 공유, 호출마다 kind/model/latency/ok 기록.
- **중복판정(통화 중)**: `judgeDuplicateWithBitdeer`: `BAAI/bge-m3` 임베딩 → `cosineSimilarity`/`rankBySimilarity` → 0.55 이상 1등만 `DeepSeek-V4.1-Flash` JSON 판정(`verdictMessages`, `parseVerdict`). `convex/dedup.ts` `judgeDuplicate`가 4 s 상한 + 휴리스틱 fallback.
- **직원 브리프(통화 후)**: `buildStaffBrief`/`parseBrief`(12단어 이하), `convex/bitdeer.ts` `generateBrief`(scheduled). 직원 카드와 ops 상세에 표시(`displayBrief`).
- **운영 지표**: `bitdeerCalls` 테이블, `bitdeer.stats` → `/ops` "Bitdeer AI" 평균 지연과 fallback 수.
- 테스트: `convex/lib/bitdeer.test.ts` 35개(주입한 fetch로 파서·타임아웃·fallback 검증).

### Anthropic
- Claude의 역할은 **전화 에이전트의 두뇌 하나**입니다(`agent/setup-cartesia.mjs`가 `claude.*sonnet` 우선 선택). 레포에 `@anthropic-ai/sdk` 의존성은 있지만 코드에서 쓰지 않습니다. "Claude를 여러 곳에 썼다"고 하지 마세요.
- 강조점: 프롬프트 설계(`agent/prompt.ts`): 응급 우선, 위치 발명 금지, 확인 1회, 도구 결과의 `message`만 말하기, 모르면 "모른다". 공익 프레임: 사용자 = 행사 참가자와 운영진, 사람 운영자를 대체하지 않고 우선순위를 정해 줌.

### People-First (사람 중심)
- 발신자: 앱 설치·로그인·이름 불필요. 확인 질문 1회.
- 위험: AI가 응급을 배정하지 않음, 911 안내, 부정문도 응급 처리.
- 직원: Decline 버튼(거절해도 불이익 없이 다음 사람에게), 브리프 한 줄, 걷는 경로 표시.
- 운영자: 막힘 Undo, 배정 이유(`assignment.reason`)가 남는 설명 가능한 규칙.
- 근거 자료: Slack 사례(네 자료).

### Best Technical / Overall / Hacker's Choice
- Best Technical: 3장 Q8 답 그대로. `planReroute`, 트랜잭션, 모든 AI 호출의 상한과 fallback, 단일 소스 생성, 테스트 122개.
- Hacker's Choice: 다른 해커들이 직접 겪은 문제다. 테이블에 번호를 크게 써 붙이고 "Call it. Report anything." 지나가는 사람이 걸면 그 자체가 홍보.
- Overall: 데모의 재배정 장면이 전부. 그 15초가 실패 없이 나오게 하는 게 최우선.

### 솔로 해커
- 첫 커밋 토요일 03:23, 현재 커밋 40개(`git log`). 혼자 백엔드, 음성, 3D, 모바일 화면, 스폰서 연동 4개. 수치로 말하기: "18 zones, 27 paths, 406 locations, 5 voice tools, 122 tests, built solo."

### Microsoft (선택)
- "Built for the real world": 실제 행사장 지도 데이터, 실제 Slack 문제, 모든 외부 의존성에 fallback. 단 Microsoft 기술은 쓰지 않았으니 트랙 요건을 먼저 확인.

---

## 5. 남은 시간 우선순위 (지금 02:00, 심사 10:30)

권장 타임라인: **02:00–04:30 작업 → 04:30–08:30 수면 → 08:30–10:30 마무리**.

| 순위 | 작업 | 시간 | 왜 |
|---|---|---|---|
| **1** | **실전 리허설 + 리셋 절차 고정** | 45분 | 수상은 재배정 15초에 달려 있음. 실제 전화로 대본을 3번 연속 돌리고 시간을 잰다. 그 과정에서 Cartesia 도구 URL/시크릿/모델(U1), "Broadway 1 hallway"가 정확히 `broadway-1` 구역으로 해석되는지, Jordan 재배정이 화면에 보이는지 확인. 심사위원마다 반복하므로 리셋을 손에 익혀야 함: `npm run reseed`(사건·직원 위치 초기화. `retrievals`/`bitdeerCalls`는 남아서 사용량 지표는 유지됨). 안 하면: 두 번째 심사위원 앞에서 Jordan이 이미 Atrium에 있거나 막힘이 남아 있어 장면이 안 나옴 |
| **2** | **백업 영상 녹화** | 30분 | 리허설이 성공한 그 상태로 바로 녹화(조용한 지금이 최적). 와이파이나 전화가 죽으면 이게 데모. Devpost에도 영상 필요. 안 하면: 장애 시 보여줄 게 없음 |
| **3** | **사실과 다른 표기 2곳 수정 + README 갱신** | 30분 | (a) `app/ops/MetricsBar.tsx`의 "Location lookup (Moss)" → "Event Q&A (Moss)". Moss 심사위원이 화면에서 바로 볼 틀린 문구. (b) `convex/lib/dedup.ts` 주석 "Claude then judges" → Bitdeer. 코드 보는 심사위원용. (c) README: HTTP 라우트 목록에 get_directions/venue_search 추가, Moss env, "Cartesia features used", "Known limitations"(이 문서 1장 표 재사용), 행사장 온보딩 절차 5줄. 기존 기능을 정확히 보이게 하는 작업이라 위험이 거의 없음 |
| **4** | **Devpost 초안 제출** | 30분 | 6장 초안 붙여넣기 + 영상 + 트랙 선택. 마감 시각이 불확실하니 자기 전에 일단 제출(보통 마감 전까지 수정 가능, 확인할 것). 안 하면: 아침에 마감에 쫓김 |
| 5 (선택) | 웹 대체 신고 폼 (`incidents.reportFromWeb` 호출하는 화면 하나) | 45–60분 | 백엔드는 이미 있음. 전화가 죽어도 라이브 데모가 가능해지고 "채널 무관 파이프라인" 주장이 사실이 됨. **1–4가 04:00 전에 끝났을 때만.** 새 UI라 버그 위험이 있으니 수면을 깎아서 하지 말 것 |

아침(08:30–10:30): `scripts/demo-up.sh` → `--check`로 `MOSS OK` 확인 → `npm run reseed` → 전화 1회 리허설 → `/demo` 띄우고 대기. 10:00 이후 기능 수정 금지.

하지 말 것: 타임아웃 재배정, 상태 조회 도구, 직원 위치 추적, 행사장 온보딩 자동화. 모두 "What's next"에 쓰면 충분하고, 지금 만들면 데모를 깰 위험만 커집니다.

---

## 6. Devpost 초안 (영어)

> `[확인 필요]` 표시는 코드로 검증하지 못한 부분입니다. 제출 전에 사실인지 확인하거나 지우세요.

### Inspiration
At a 1,000+ person hackathon, venue problems are reported in Slack threads. `[확인 필요: 아래 Slack 사례는 본인 수집 자료]` Last night at Cal Hacks, a broken-outlet report got no reply, a question about cups at the water stations took about three hours to answer, and pinning down the location of a lights request took four back-and-forth messages. Stadiums already run text-line dispatch systems for this. We wanted something anyone can use with zero setup: call a number, say what's wrong, and the right person walks over by the right route.

### What it does
PeopleOS is an AI phone line plus a live operations map for a venue.
- **Call and report.** A Cartesia voice agent (Claude as the LLM) `[확인 필요: Cartesia에 설정된 모델]` takes the report, matches the location to one of 406 real places in the venue (304 hacker tables, sponsor booths, rooms, entrances), and confirms it with exactly one question: "Table 142 on the main floor, right?"
- **Spatial dispatch.** The incident appears on a live 3D model of the Palace of Fine Arts. PeopleOS picks a staff member by role, availability, current workload, and walking distance through the venue graph (Dijkstra, stairs cost extra), then draws the route and buzzes their phone.
- **Blockage-aware rerouting.** Report a blocked hallway and the edges close instantly; every open task is re-planned, and if someone else is now closer the task moves to them with a new route. Operators can undo with one click.
- **Duplicate detection.** A repeat report about the same problem increments the report count instead of creating a second task. Bitdeer bge-m3 embeddings rank candidates and a Bitdeer-hosted model judges "same problem?", capped at 4 seconds with a rule-based fallback.
- **Emergencies go to humans.** Injury, fire, or safety reports are never auto-dispatched. The agent escalates to a human operator and tells the caller to call 911, and the server enforces the same rule independently of the prompt.
- **Staff phone and ops dashboard.** Staff accept, decline (auto re-dispatch to the next best person), and complete from a mobile web page; each task carries a one-line brief generated by Bitdeer. The ops dashboard shows the 3D map, incident list, staff status, and average time-to-acknowledge.
- **Answers, too.** Callers can ask for walking directions ("how do I get to the Box Office from table 142?"), which avoid blocked paths, and event questions (meals, showers, wifi rules) answered from a Moss index.

### How we built it
- **Cartesia Managed Agents**: agent, five webhook tools, and phone number provisioned by script (`agent/setup-cartesia.mjs`); speech keyterms for venue words; tool calls hit Convex HTTP actions with bearer auth.
- **Convex**: schema for zones, edges, locations, staff, incidents, assignments; HTTP routes for the agent; the report pipeline as an action (external AI calls) feeding queries and mutations. Applying a blockage and rerouting every assignment happen in a single transaction, and the dashboard and staff phones update through live queries. The scheduler generates staff briefs off the call path.
- **Bitdeer AI Model Studio**: `BAAI/bge-m3` embeddings and `DeepSeek-V4.1-Flash` for duplicate verdicts and staff briefs; every call is logged with latency.
- **Moss**: hybrid search index of event facts and venue areas, queried from a small Node server and reached by Convex with a 2-second limit and a keyword fallback.
- **React Three Fiber**: the venue rendered from the organizers' map data (credit: palace-interior.vercel.app), with incident markers, staff dots, and route lines that follow the actual graph edges, including the mezzanine.
- **One source of truth**: the agent's location vocabulary, prompt, venue guide, and search documents are generated from the same venue data that seeds the database, so the agent can never name a place the backend can't resolve.
- Next.js, TypeScript, Tailwind; 122 Vitest unit tests, including the exact demo scenario.

### Challenges we ran into
- **Latency inside a phone call.** Every AI step had to be bounded: dedup is capped at 4 s with a rule fallback, event search at 2 s with a keyword fallback, and the staff brief runs after the call through the scheduler.
- **Moss in a serverless backend.** Moss's in-process embedding model could not load inside Convex actions, so queries run on a small search server reached over HTTP, and the system degrades to keyword search if it is unreachable.
- **A reasoning model that ran out of tokens.** The brief model spent 180–350 tokens reasoning before answering, so a 200-token limit returned empty briefs; we found it by logging every Bitdeer call and raised the budget.
- **Turning a map into a graph.** The organizers' map has tables and walls, not walkways. We drew 18 zones and 27 walkable connections with door and stair waypoints so routes don't cut through walls, and mapped every table, booth, and room to a zone.
- **Rerouting without thrashing.** When a blockage changes the graph, the current assignee competes with their own task removed from their workload, so an unchanged graph never reassigns and two incidents never silently land on the same newly free person.

### Accomplishments that we're proud of
- The blockage scene: one phone call closes a hallway, and the task visibly moves to a different staff member on a new route, live on the 3D map and on both phones.
- Emergencies are handled by design: two independent layers, never auto-dispatched, never dropped even when the location is unclear.
- The voice line never fails silently: every AI dependency has a time limit and a non-AI fallback.
- Built solo during the hackathon (first commit Saturday 3:23 AM): backend, voice agent, 3D venue, staff and ops apps, and four sponsor integrations, with 122 tests.

### What we learned
`[본인이 직접 쓰는 게 좋음. 후보:]` Voice is the right input for the long tail of people who will never install an app, but the agent is only reliable when its world is closed: a fixed location list generated from data beat free-form extraction. And keeping dispatch as explainable rules, with AI only at the edges (listening, deduplicating, summarizing), made the system easier to trust and to test.

### What's next for PeopleOS
- **Venue onboarding from a floor plan**: generate zones and walkways automatically instead of drawing them, and move the remaining venue-specific strings into config.
- **Timeout re-dispatch** for unanswered offers, and paging the ops lead's phone on escalations.
- **A status tool for callers** ("is my report being handled?") and SMS/web reporting on top of the existing channel-agnostic pipeline.
- **Finer staff location** (tap-to-check-in or indoor positioning) in place of zone-level presence.
- Operator review step for blockage reports before they apply.
