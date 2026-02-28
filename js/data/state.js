export const state = {
  user: {
    id: "user_001",
    email: "abdulroqib@gmail.com",
    name: "Abdulroqib",
    created_at: "01/01/2026",
  },

  workspaces: [
    {
      id: "ws_005",
      name: "Product Strategy Team",
      admin_id: "admin_004",
      created_at: 1708259123456,
      role: "admin",
      status: "active",
      description:
        "Team responsible for long-term product direction and planning.",

      members: [
        { id: "admin_004", name: "Aisha", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
        { id: "member_010", name: "Daniel", role: "member" },
      ],

      workspace_tasks: [
        {
          id: "wst_101",
          title: "Define Q2 product roadmap",
          assigned_to: "user_001",
          state: "in-progress",
          description: "",
          logs: [
            {
              id: "log_501",
              user_id: "user_001",
              note: "Outlined initial roadmap structure",
              date: "2026-02-18",
              progress: "in-progress",
              admin_comment: "Good direction",
            },
          ],
        },
        {
          id: "wst_102",
          title: "Define Q1 product roadmap",
          assigned_to: "user_002",
          state: "in-progress",
          description: "",
          logs: [
            {
              id: "log_501",
              user_id: "user_001",
              note: "Outlined initial roadmap structure",
              date: "2026-02-18",
              progress: "in-progress",
              admin_comment: "Good direction",
            },
          ],
        },
      ],

      activity: [
        {
          id: "act_301",
          type: "task_created",
          user_id: "admin_004",
          task_id: "wst_101",
          timestamp: 1708259123456,
        },
      ],
    },

    {
      id: "ws_006",
      name: "QA & Testing Team",
      admin_id: "member_002",
      created_at: 1708259189021,
      role: "member",
      status: "active",
      description: "Handles automated and manual testing for all releases.",

      members: [
        { id: "member_002", name: "Sarah", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
        { id: "member_011", name: "Tomi", role: "member" },
      ],

      workspace_tasks: [
        {
          id: "wst_102",
          title: "Regression test for v1.4",
          assigned_to: "member_011",
          state: "open",
          priority: "medium",
          due_date: "2026-02-25",
          logs: [],
        },
      ],

      activity: [
        {
          id: "act_302",
          type: "member_joined",
          user_id: "user_001",
          timestamp: 1708259189021,
        },
      ],
    },

    {
      id: "ws_007",
      name: "Frontend Engineering",
      admin_id: "admin_005",
      created_at: 1708261123000,
      role: "admin",
      status: "active",
      description:
        "Develops UI components and ensures consistent user experience.",

      members: [
        { id: "admin_005", name: "Michael", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
        { id: "member_012", name: "Joy", role: "member" },
      ],

      workspace_tasks: [
        {
          id: "wst_103",
          title: "Refactor modal system",
          assigned_to: "user_001",
          state: "in-progress",
          priority: "high",
          due_date: "2026-02-22",
          logs: [
            {
              id: "log_502",
              user_id: "user_001",
              note: "Improved event listener cleanup",
              date: "2026-02-17",
              progress: "in-progress",
              admin_comment: null,
            },
          ],
        },
      ],

      activity: [
        {
          id: "act_303",
          type: "log_added",
          user_id: "user_001",
          user_name: "Abdulroqib",
          task_id: "wst_103",
          timestamp: 1708261123000,
        },
      ],
    },

    {
      id: "ws_008",
      name: "Backend Engineering",
      admin_id: "admin_006",
      created_at: 1708265123000,
      role: "admin",
      status: "closed",
      closed_at: 1709271123000,
      description: "API development and database architecture team.",

      members: [
        { id: "admin_006", name: "Victor", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_009",
      name: "Customer Support Team",
      admin_id: "member_003",
      created_at: 1708271123000,
      role: "member",
      status: "active",
      description: "Handles customer inquiries and support tickets.",

      members: [
        { id: "member_003", name: "Lara", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_010",
      name: "Sales Operations",
      admin_id: "admin_007",
      created_at: 1708281123000,
      role: "admin",
      status: "closed",
      closed_at: 1709301123000,
      description: "Manages sales pipelines and client acquisition processes.",

      members: [
        { id: "admin_007", name: "Samuel", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_011",
      name: "Content Creation Team",
      admin_id: "member_004",
      created_at: 1708291123000,
      role: "member",
      status: "active",
      description:
        "Creates marketing materials, blog posts, and social content.",

      members: [
        { id: "member_004", name: "Grace", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_012",
      name: "Security & Compliance",
      admin_id: "admin_008",
      created_at: 1708301123000,
      role: "admin",
      status: "active",
      description: "Ensures platform security and regulatory compliance.",

      members: [
        { id: "admin_008", name: "Omar", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_013",
      name: "DevOps Team",
      admin_id: "admin_009",
      created_at: 1708311123000,
      role: "admin",
      status: "closed",
      closed_at: 1709401123000,
      description: "Responsible for CI/CD pipelines and deployment automation.",

      members: [
        { id: "admin_009", name: "Henry", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_014",
      name: "Research & Innovation",
      admin_id: "member_005",
      created_at: 1708321123000,
      role: "member",
      status: "active",
      description: "Explores new technologies and experimental features.",

      members: [
        { id: "member_005", name: "Ibrahim", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_015",
      name: "Brand Identity Team",
      admin_id: "admin_010",
      created_at: 1708331123000,
      role: "admin",
      status: "active",
      description: "Maintains brand guidelines and visual identity.",

      members: [
        { id: "admin_010", name: "Chloe", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_016",
      name: "Internal Tools Team",
      admin_id: "admin_011",
      created_at: 1708341123000,
      role: "admin",
      status: "closed",
      closed_at: 1709501123000,
      description: "Builds internal utilities to support company operations.",

      members: [
        { id: "admin_011", name: "Kelvin", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_017",
      name: "Community Management",
      admin_id: "member_006",
      created_at: 1708351123000,
      role: "member",
      status: "active",
      description: "Engages with users and manages community channels.",

      members: [
        { id: "member_006", name: "Rita", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },

    {
      id: "ws_018",
      name: "Partnerships Team",
      admin_id: "admin_012",
      created_at: 1708361123000,
      role: "admin",
      status: "active",
      description: "Develops strategic partnerships and collaborations.",

      members: [
        { id: "admin_012", name: "Leo", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [
        {
          id: "wst_101",
          title: "Define Q2 product roadmap",
          assigned_to: "user_001",
          state: "in-progress",
          priority: "high",
          due_date: "2026-03-01",
          logs: [
            {
              id: "log_501",
              user_id: "user_001",
              note: "Outlined initial roadmap structure",
              date: "2026-02-18",
              progress: "in-progress",
              admin_comment: "Good direction",
            },
          ],
        },
        {
          id: "wst_102",
          title: "Define Q1 product roadmap",
          assigned_to: "",
          state: "in-progress",
          priority: "low",
          due_date: "2026-03-01",
          logs: [
            {
              id: "log_501",
              user_id: "user_001",
              note: "Outlined initial roadmap structure",
              date: "2026-02-18",
              progress: "in-progress",
              admin_comment: "Good direction",
            },
          ],
        },
      ],
      activity: [
        {
          id: crypto.randomUUID(),
          user_id: "user_001",
          user_name: "Abdulroqib",
          task_id: "wst_103",
          type: "log_added",
          taskValue: "Refactored sidebar component",
          noteValue: "Cleaned up event listeners and improved toggle logic.",
          timestamp: 1708261123000,
        },
      ],
    },

    {
      id: "ws_019",
      name: "Analytics & Insights",
      admin_id: "member_007",
      created_at: 1708371123000,
      role: "member",
      status: "active",
      description: "Analyzes user behavior and generates actionable insights.",

      members: [
        { id: "member_007", name: "Sophia", role: "admin" },
        { id: "user_001", name: "Abdulroqib", role: "member" },
      ],

      workspace_tasks: [],
      activity: [],
    },
  ],
  tasks: [
    /*
    {
      id: "task_001",
      workspace_id: "ws_001",
      title: "Design Dashboard UI",
      description:
        "Design Dashboard UI and add all navigation link and popup modals.",
      assigned_to: "user_001",
      status: "in-progress",
      dueDate: "2025-02-20",
    },
    */

    {
      id: crypto.randomUUID(),
      taskValue: "Refactored sidebar component",
      timeValue: "2026-02-15T10:30",
      noteValue: "Cleaned up event listeners and improved toggle logic.",
    },
    {
      id: crypto.randomUUID(),
      taskValue: "Designed workspace cards",
      timeValue: "2026-02-14T16:45",
      noteValue: "Added role badges and improved spacing for readability.",
    },
    {
      id: crypto.randomUUID(),
      taskValue: "Integrated personal task logger",
      timeValue: "2026-02-13T09:10",
      noteValue: "Merged Solo UI into Team dashboard and synced state.",
    },
    {
      id: crypto.randomUUID(),
      taskValue: "Updated dashboard summary",
      timeValue: "2026-02-12T14:20",
      noteValue: "Added dynamic counts for workspaces and tasks.",
    },
    {
      id: crypto.randomUUID(),
      taskValue: "Improved placeholder logic",
      timeValue: "2026-02-11T18:05",
      noteValue:
        "Ensured empty-state message appears correctly after deletions.",
    },
  ],
};