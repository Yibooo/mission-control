import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────
// LEADS — 見込み企業 CRUD
// ─────────────────────────────────────────────────────────────────

export const listLeads = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const all = await ctx.db.query("leads").order("desc").collect();
    if (!status) return all;
    return all.filter((l) => l.status === status);
  },
});

export const getLead = query({
  args: { id: v.id("leads") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const createLead = mutation({
  args: {
    companyName: v.string(),
    industry: v.string(),
    location: v.string(),
    estimatedSize: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    contactFormUrl: v.optional(v.string()),   // Phase 2-D
    formFields: v.optional(v.string()),        // Phase 2-D
    contactEmail: v.string(),
    contactName: v.optional(v.string()),
    researchSummary: v.optional(v.string()),
    source: v.optional(v.string()),
    assignedAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const leadId = await ctx.db.insert("leads", {
      ...args,
      status: "researching",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("salesLogs", {
      leadId,
      event: "lead_created",
      detail: `${args.companyName} をリードとして追加`,
      performedBy: "agent:Prospector",
      createdAt: now,
    });
    return leadId;
  },
});

export const updateLeadStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.union(
      v.literal("researching"),
      v.literal("draft_ready"),
      v.literal("captcha_required"),
      v.literal("contacted"),
      v.literal("replied"),
      v.literal("negotiating"),
      v.literal("closed_won"),
      v.literal("closed_lost"),
      v.literal("rejected")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, notes }) => {
    await ctx.db.patch(id, { status, notes, updatedAt: Date.now() });
  },
});

export const updateLeadResearch = mutation({
  args: {
    id: v.id("leads"),
    researchSummary: v.string(),
  },
  handler: async (ctx, { id, researchSummary }) => {
    const now = Date.now();
    await ctx.db.patch(id, { researchSummary, updatedAt: now });
    await ctx.db.insert("salesLogs", {
      leadId: id,
      event: "research_done",
      detail: "リサーチ完了",
      performedBy: "agent:Researcher",
      createdAt: now,
    });
  },
});

// ─────────────────────────────────────────────────────────────────
// EMAIL DRAFTS — 生成メール草稿 CRUD
// ─────────────────────────────────────────────────────────────────

export const listEmailDrafts = query({
  args: { approvalStatus: v.optional(v.string()) },
  handler: async (ctx, { approvalStatus }) => {
    const all = await ctx.db.query("emailDrafts").order("desc").collect();
    if (!approvalStatus) return all;
    return all.filter((d) => d.approvalStatus === approvalStatus);
  },
});

export const getDraftByLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const drafts = await ctx.db.query("emailDrafts").collect();
    return drafts.find((d) => d.leadId === leadId) ?? null;
  },
});

export const createEmailDraft = mutation({
  args: {
    leadId: v.id("leads"),
    subject: v.string(),
    body: v.string(),
    generatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const draftId = await ctx.db.insert("emailDrafts", {
      ...args,
      approvalStatus: "pending",
      createdAt: now,
    });
    // リードステータスを draft_ready に更新
    await ctx.db.patch(args.leadId, { status: "draft_ready", updatedAt: now });
    await ctx.db.insert("salesLogs", {
      leadId: args.leadId,
      emailDraftId: draftId,
      event: "draft_generated",
      detail: `件名: ${args.subject}`,
      performedBy: "agent:Copywriter",
      createdAt: now,
    });
    return draftId;
  },
});

export const approveDraft = mutation({
  args: {
    draftId: v.id("emailDrafts"),
    editedBody: v.optional(v.string()),
  },
  handler: async (ctx, { draftId, editedBody }) => {
    const now = Date.now();
    await ctx.db.patch(draftId, {
      approvalStatus: "approved",
      editedBody,
      approvedAt: now,
    });
    const draft = await ctx.db.get(draftId);
    if (draft) {
      await ctx.db.insert("salesLogs", {
        leadId: draft.leadId,
        emailDraftId: draftId,
        event: "approved",
        detail: editedBody ? "編集の上、承認" : "承認",
        performedBy: "human",
        createdAt: now,
      });
    }
  },
});

export const rejectDraft = mutation({
  args: {
    draftId: v.id("emailDrafts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { draftId, reason }) => {
    const now = Date.now();
    await ctx.db.patch(draftId, { approvalStatus: "rejected" });
    const draft = await ctx.db.get(draftId);
    if (draft) {
      await ctx.db.patch(draft.leadId, { status: "rejected", updatedAt: now });
      await ctx.db.insert("salesLogs", {
        leadId: draft.leadId,
        emailDraftId: draftId,
        event: "rejected",
        detail: reason ?? "却下",
        performedBy: "human",
        createdAt: now,
      });
    }
  },
});

export const markDraftSent = mutation({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, { draftId }) => {
    const now = Date.now();
    await ctx.db.patch(draftId, { approvalStatus: "sent", sentAt: now });
    const draft = await ctx.db.get(draftId);
    if (draft) {
      await ctx.db.patch(draft.leadId, { status: "contacted", updatedAt: now });
      await ctx.db.insert("salesLogs", {
        leadId: draft.leadId,
        emailDraftId: draftId,
        event: "sent",
        performedBy: "agent:Sender",
        createdAt: now,
      });
    }
  },
});

// Phase 2-D: フォーム送信完了
export const markDraftSubmitted = mutation({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, { draftId }) => {
    const now = Date.now();
    await ctx.db.patch(draftId, { approvalStatus: "submitted", submittedAt: now });
    const draft = await ctx.db.get(draftId);
    if (draft) {
      await ctx.db.patch(draft.leadId, { status: "contacted", updatedAt: now });
      await ctx.db.insert("salesLogs", {
        leadId: draft.leadId,
        emailDraftId: draftId,
        event: "form_submitted",
        detail: "フォーム経由で送信完了",
        performedBy: "agent:FormSubmitter",
        createdAt: now,
      });
    }
  },
});

// Phase 2-D: フォーム送信失敗
export const markDraftFailed = mutation({
  args: {
    draftId: v.id("emailDrafts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { draftId, reason }) => {
    const now = Date.now();
    await ctx.db.patch(draftId, { approvalStatus: "failed", failureReason: reason });
    const draft = await ctx.db.get(draftId);
    if (draft) {
      await ctx.db.insert("salesLogs", {
        leadId: draft.leadId,
        emailDraftId: draftId,
        event: "submission_failed",
        detail: reason ?? "送信失敗",
        performedBy: "agent:FormSubmitter",
        createdAt: now,
      });
    }
  },
});

// Phase 2-D: draft を ID で取得
export const getDraftById = query({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, { draftId }) => {
    return await ctx.db.get(draftId);
  },
});

// ─────────────────────────────────────────────────────────────────
// SALES LOGS — アクティビティログ参照
// ─────────────────────────────────────────────────────────────────

export const listSalesLogs = query({
  args: { leadId: v.optional(v.id("leads")), limit: v.optional(v.number()) },
  handler: async (ctx, { leadId, limit }) => {
    let logs = await ctx.db.query("salesLogs").order("desc").collect();
    if (leadId) logs = logs.filter((l) => l.leadId === leadId);
    return logs.slice(0, limit ?? 50);
  },
});

// ─────────────────────────────────────────────────────────────────
// STATS — ダッシュボード統計
// ─────────────────────────────────────────────────────────────────

export const getSalesStats = query({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("leads").collect();
    const drafts = await ctx.db.query("emailDrafts").collect();
    return {
      totalLeads: leads.length,
      pendingApprovals: drafts.filter((d) => d.approvalStatus === "pending").length,
      sent: leads.filter((l) => l.status === "contacted").length,
      replied: leads.filter((l) => l.status === "replied").length,
      negotiating: leads.filter((l) => l.status === "negotiating").length,
      closedWon: leads.filter((l) => l.status === "closed_won").length,
    };
  },
});

// ─────────────────────────────────────────────────────────────────
// MOCK AGENT RUN — APIキーなしでE2Eフローをテストするモック
// 実際のAPI連携時は this 関数を salesAgent.ts の action に置き換える
// ─────────────────────────────────────────────────────────────────

export const runMockSalesAgent = mutation({
  args: {
    targetArea: v.optional(v.string()),
    targetIndustry: v.optional(v.string()),
    count: v.optional(v.number()),
  },
  handler: async (ctx, { targetArea = "東京都", targetIndustry = "不問", count = 3 }) => {
    const now = Date.now();

    const mockLeads = [
      {
        companyName: "株式会社ひまわりフーズ",
        industry: "食品小売",
        location: "東京都渋谷区",
        estimatedSize: "〜30名",
        websiteUrl: "https://example-himawari.co.jp",
        contactEmail: "info@example-himawari.co.jp",
        contactName: "田中 花子",
        researchSummary:
          "食品スーパーを3店舗運営。在庫管理はExcelベースで月次の発注ミスが課題。競合他社がPOSシステムにAIを導入し始めており、対応を検討中。ChatGPT等の生成AIは未活用。",
        subject: "【在庫管理の自動化】月の発注ミスをゼロにできます — AI駆け込み寺",
        body: `田中様

突然のご連絡失礼いたします。中小企業向けAI導入支援「AI駆け込み寺」の周と申します。

御社のWebサイトを拝見し、食品スーパー3店舗を運営されていることを知りました。

食品小売業様では在庫管理・発注業務でのヒューマンエラーが大きな課題となるケースが多く、ChatGPTやAIツールを活用することで月に10〜20時間の業務削減を実現した事例が増えています。

まずは30分の無料相談で、御社の現状に合ったAI活用方法をご提案できればと思います。

ご都合のよい日程をお知らせいただけますでしょうか。

━━━━━━━━━━━━━━━━━━━━━━━
AI駆け込み寺
https://ai-kakekomi-dera.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━`,
      },
      {
        companyName: "東京テックサービス株式会社",
        industry: "IT・Webサービス",
        location: "東京都新宿区",
        estimatedSize: "10〜50名",
        websiteUrl: "https://example-tokyotech.co.jp",
        contactEmail: "contact@example-tokyotech.co.jp",
        contactName: "鈴木 一郎",
        researchSummary:
          "中小企業向けのWebシステム開発会社。受注管理・見積もり作成に多くの手作業が発生。エンジニアの採用コスト高騰に悩んでいる様子。社内DX推進に関心あり。",
        subject: "【見積もり作成の自動化】エンジニアの工数を30%削減できます — AI駆け込み寺",
        body: `鈴木様

はじめまして。中小企業向けAI導入支援「AI駆け込み寺」の周と申します。

IT企業様でも「見積もり作成」「要件整理」「議事録作成」などルーティン業務に多くの時間がかかっているケースをよくお聞きします。

Claude・ChatGPTなどのAIツールをワークフローに組み込むことで、こうした業務を大幅に効率化できます。IT企業様だからこそ、まず社内で実践してみることが重要です。

30分の無料相談で、すぐに始められるAI活用法をご提案します。

ご興味があればお気軽にご連絡ください。

━━━━━━━━━━━━━━━━━━━━━━━
AI駆け込み寺
https://ai-kakekomi-dera.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━`,
      },
      {
        companyName: "横浜総合法律事務所",
        industry: "士業・法律",
        location: "神奈川県横浜市",
        estimatedSize: "〜10名",
        websiteUrl: "https://example-yokohama-law.co.jp",
        contactEmail: "info@example-yokohama-law.co.jp",
        contactName: undefined,
        researchSummary:
          "弁護士3名・スタッフ5名の法律事務所。契約書レビュー・書類作成に多くの時間を費やしている。顧客管理はメールと紙ベース。AIによる契約書ドラフト作成への関心が業界全体で高まっている。",
        subject: "【契約書作成の時間を半分に】士業向けAI活用事例のご紹介 — AI駆け込み寺",
        body: `ご担当者様

突然のご連絡失礼いたします。中小企業向けAI導入支援「AI駆け込み寺」の周と申します。

法律事務所様では「契約書のドラフト作成」「判例調査」「書類整理」といった業務への AI活用が急速に広まっています。

特にClaude（Anthropic社）は長文の法律文書の読み込みと要約に優れており、契約書レビュー時間を大幅に削減できます。

もちろん、最終確認は必ず専門家が行う前提で、AIはあくまでドラフト作成や情報整理のアシスタントとして活用します。

30分の無料相談で、実際の活用事例をご紹介できればと思います。

━━━━━━━━━━━━━━━━━━━━━━━
AI駆け込み寺
https://ai-kakekomi-dera.vercel.app
━━━━━━━━━━━━━━━━━━━━━━━`,
      },
    ].slice(0, count);

    const createdIds: Id<"leads">[] = [];

    for (const mock of mockLeads) {
      const { subject, body, ...leadData } = mock;

      // Lead 作成
      const leadId = await ctx.db.insert("leads", {
        ...leadData,
        status: "draft_ready",
        source: "mock_agent",
        createdAt: now,
        updatedAt: now,
      });

      // salesLog: lead_created
      await ctx.db.insert("salesLogs", {
        leadId,
        event: "lead_created",
        detail: `${leadData.companyName} を${targetArea}から発見`,
        performedBy: "agent:Prospector",
        createdAt: now,
      });

      // salesLog: research_done
      await ctx.db.insert("salesLogs", {
        leadId,
        event: "research_done",
        detail: "Webサイト調査・AI活用余地分析完了",
        performedBy: "agent:Researcher",
        createdAt: now + 1,
      });

      // Email Draft 作成
      const draftId = await ctx.db.insert("emailDrafts", {
        leadId,
        subject,
        body,
        approvalStatus: "pending",
        generatedBy: "agent:Copywriter",
        createdAt: now + 2,
      });

      // salesLog: draft_generated
      await ctx.db.insert("salesLogs", {
        leadId,
        emailDraftId: draftId,
        event: "draft_generated",
        detail: `件名: ${subject}`,
        performedBy: "agent:Copywriter",
        createdAt: now + 3,
      });

      createdIds.push(leadId);
    }

    return { createdCount: createdIds.length, leadIds: createdIds };
  },
});

// ─────────────────────────────────────────────────────────────────
// PENDING APPROVALS — 承認待ちリスト（リード情報込み）
// ─────────────────────────────────────────────────────────────────

export const listPendingApprovals = query({
  args: {},
  handler: async (ctx) => {
    const pendingDrafts = await ctx.db
      .query("emailDrafts")
      .filter((q) => q.eq(q.field("approvalStatus"), "pending"))
      .order("desc")
      .collect();

    const results = await Promise.all(
      pendingDrafts.map(async (draft) => {
        const lead = await ctx.db.get(draft.leadId);
        return { draft, lead };
      })
    );

    return results.filter((r) => r.lead !== null);
  },
});
