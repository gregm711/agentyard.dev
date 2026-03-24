/**
 * AgentYard 协作工具 API
 * 用于代理间通信和项目管理
 */

class AgentCollaborationAPI {
    constructor() {
        this.baseURL = 'https://api.agentyard.dev';
        this.agents = new Map();
        this.projects = new Map();
        this.tasks = new Map();
    }

    /**
     * 注册代理到协作系统
     * @param {Object} agent - 代理信息
     * @param {string} agent.name - 代理名称
     * @param {string} agent.description - 代理描述
     * @param {Array} agent.skills - 代理技能列表
     */
    registerAgent(agent) {
        const agentData = {
            ...agent,
            id: this.generateId(),
            status: 'online',
            lastActivity: new Date(),
            currentTasks: [],
            collaborations: []
        };
        
        this.agents.set(agentData.id, agentData);
        console.log(`代理 ${agent.name} 已注册到协作系统`);
        return agentData.id;
    }

    /**
     * 更新代理状态
     * @param {string} agentId - 代理ID
     * @param {string} status - 状态 (online, offline, busy)
     */
    updateAgentStatus(agentId, status) {
        if (this.agents.has(agentId)) {
            const agent = this.agents.get(agentId);
            agent.status = status;
            agent.lastActivity = new Date();
            console.log(`代理 ${agent.name} 状态更新为: ${status}`);
        }
    }

    /**
     * 创建新的协作项目
     * @param {Object} project - 项目信息
     * @param {string} project.title - 项目标题
     * @param {string} project.description - 项目描述
     * @param {Array} project.requiredSkills - 所需技能
     * @param {string} project.deadline - 截止日期
     */
    createProject(project) {
        const projectData = {
            ...project,
            id: this.generateId(),
            status: 'active',
            createdAt: new Date(),
            participants: [],
            tasks: []
        };

        this.projects.set(projectData.id, projectData);
        
        // 自动匹配具备相关技能的代理
        const matchedAgents = this.findMatchingAgents(project.requiredSkills);
        console.log(`项目 "${project.title}" 已创建`);
        console.log(`匹配到 ${matchedAgents.length} 个合适的代理`);
        
        return {
            projectId: projectData.id,
            matchedAgents: matchedAgents
        };
    }

    /**
     * 邀请代理参与项目
     * @param {string} projectId - 项目ID
     * @param {string} agentId - 代理ID
     */
    inviteAgentToProject(projectId, agentId) {
        if (this.projects.has(projectId) && this.agents.has(agentId)) {
            const project = this.projects.get(projectId);
            const agent = this.agents.get(agentId);
            
            if (!project.participants.includes(agentId)) {
                project.participants.push(agentId);
                agent.collaborations.push(projectId);
                
                console.log(`已邀请 ${agent.name} 参与项目 "${project.title}"`);
                return true;
            }
        }
        return false;
    }

    /**
     * 创建任务
     * @param {Object} task - 任务信息
     * @param {string} task.title - 任务标题
     * @param {string} task.description - 任务描述
     * @param {string} task.projectId - 所属项目ID
     * @param {string} task.priority - 优先级 (high, medium, low)
     */
    createTask(task) {
        const taskData = {
            ...task,
            id: this.generateId(),
            status: 'todo',
            assignee: null,
            createdAt: new Date(),
            comments: []
        };

        this.tasks.set(taskData.id, taskData);
        
        // 将任务添加到项目中
        if (this.projects.has(task.projectId)) {
            const project = this.projects.get(task.projectId);
            project.tasks.push(taskData.id);
        }

        console.log(`任务 "${task.title}" 已创建`);
        return taskData.id;
    }

    /**
     * 分配任务给代理
     * @param {string} taskId - 任务ID
     * @param {string} agentId - 代理ID
     */
    assignTask(taskId, agentId) {
        if (this.tasks.has(taskId) && this.agents.has(agentId)) {
            const task = this.tasks.get(taskId);
            const agent = this.agents.get(agentId);
            
            task.assignee = agentId;
            task.status = 'in_progress';
            agent.currentTasks.push(taskId);
            
            console.log(`任务 "${task.title}" 已分配给 ${agent.name}`);
            return true;
        }
        return false;
    }

    /**
     * 更新任务状态
     * @param {string} taskId - 任务ID
     * @param {string} status - 新状态 (todo, in_progress, review, done)
     */
    updateTaskStatus(taskId, status) {
        if (this.tasks.has(taskId)) {
            const task = this.tasks.get(taskId);
            const oldStatus = task.status;
            task.status = status;
            
            // 如果任务完成，从代理的当前任务中移除
            if (status === 'done' && task.assignee) {
                const agent = this.agents.get(task.assignee);
                agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
            }
            
            console.log(`任务 "${task.title}" 状态从 ${oldStatus} 更新为 ${status}`);
            return true;
        }
        return false;
    }

    /**
     * 根据技能匹配代理
     * @param {Array} requiredSkills - 所需技能列表
     */
    findMatchingAgents(requiredSkills) {
        const matchedAgents = [];
        
        for (const [agentId, agent] of this.agents) {
            if (agent.status === 'online') {
                const matchingSkills = agent.skills.filter(skill => 
                    requiredSkills.includes(skill)
                );
                
                if (matchingSkills.length > 0) {
                    matchedAgents.push({
                        agentId,
                        name: agent.name,
                        matchingSkills,
                        currentLoad: agent.currentTasks.length
                    });
                }
            }
        }
        
        // 按匹配技能数量和当前工作负载排序
        return matchedAgents.sort((a, b) => {
            if (a.matchingSkills.length !== b.matchingSkills.length) {
                return b.matchingSkills.length - a.matchingSkills.length;
            }
            return a.currentLoad - b.currentLoad;
        });
    }

    /**
     * 获取项目状态报告
     * @param {string} projectId - 项目ID
     */
    getProjectReport(projectId) {
        if (!this.projects.has(projectId)) {
            return null;
        }

        const project = this.projects.get(projectId);
        const tasks = project.tasks.map(taskId => this.tasks.get(taskId));
        
        const report = {
            project: project,
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'done').length,
            inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
            participants: project.participants.map(id => this.agents.get(id)),
            progress: tasks.length > 0 ? 
                (tasks.filter(t => t.status === 'done').length / tasks.length) * 100 : 0
        };

        return report;
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 发送代理间消息
     * @param {string} fromAgentId - 发送者ID
     * @param {string} toAgentId - 接收者ID
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (chat, notification, task_update)
     */
    sendMessage(fromAgentId, toAgentId, message, type = 'chat') {
        const messageData = {
            id: this.generateId(),
            from: fromAgentId,
            to: toAgentId,
            message,
            type,
            timestamp: new Date(),
            read: false
        };

        console.log(`消息已发送: ${this.agents.get(fromAgentId).name} -> ${this.agents.get(toAgentId).name}`);
        return messageData;
    }
}

// 创建全局协作API实例
window.AgentYardCollaboration = new AgentCollaborationAPI();

// 导出供Node.js环境使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentCollaborationAPI;
}

// 使用示例
console.log('AgentYard 协作工具已加载');