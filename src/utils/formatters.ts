import { ToolResult } from '../tools/base.js';

interface PaginatedResponse {
  data: any[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

export class ResponseFormatter {
  /**
   * Format a paginated list response with entity-specific formatting
   */
  formatPaginatedList(response: PaginatedResponse, entityType: string, queryParams?: any): ToolResult {
    const items = response.data || [];
    const meta = response.meta;
    const total = meta?.total || items.length;
    const page = queryParams?.page || meta?.page || 0;
    const limit = queryParams?.limit || meta?.limit || items.length || 10;
    const totalPages = Math.ceil(total / limit);
    
    let resultText = `Found ${total} ${entityType}`;
    if (totalPages > 1) {
      resultText += ` (page ${page + 1} of ${totalPages})`;
    }
    resultText += '\n\n';
    
    if (items.length === 0) {
      resultText += `No ${entityType} found matching your criteria.`;
    } else {
      items.forEach((item: any, index: number) => {
        const formatted = this.formatEntity(item, entityType);
        resultText += `${index + 1}. ${formatted}\n`;
      });
    }
    
    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }
  
  /**
   * Format a single entity response
   */
  formatSingleEntity(entity: any, entityType: string): ToolResult {
    const formatted = this.formatEntity(entity, entityType, true);
    
    return {
      content: [
        {
          type: 'text',
          text: formatted
        }
      ]
    };
  }
  
  /**
   * Route to appropriate formatter based on entity type
   */
  private formatEntity(entity: any, entityType: string, detailed: boolean = false): string {
    const normalizedType = entityType.toLowerCase().replace(/s$/, '');
    
    switch (normalizedType) {
      case 'module':
        return this.formatModule(entity, detailed);
      case 'player':
        return this.formatPlayer(entity, detailed);
      case 'gameserver':
      case 'game server':
        return this.formatGameserver(entity, detailed);
      case 'item':
        return this.formatItem(entity, detailed);
      case 'role':
        return this.formatRole(entity, detailed);
      case 'hook':
        return this.formatHook(entity, detailed);
      case 'cronjob':
      case 'cron job':
        return this.formatCronJob(entity, detailed);
      case 'event':
        return this.formatEvent(entity, detailed);
      case 'function':
        return this.formatFunction(entity, detailed);
      case 'variable':
        return this.formatVariable(entity, detailed);
      case 'command':
        return this.formatCommand(entity, detailed);
      default:
        return this.formatGeneric(entity, detailed);
    }
  }
  
  /**
   * Format a module entity
   */
  private formatModule(module: any, detailed: boolean = false): string {
    let result = module.name || 'Unnamed Module';
    result += `\n   ID: ${module.id}`;
    
    if (module.description) {
      result += `\n   Description: ${module.description}`;
    }
    if (module.author) {
      result += `\n   Author: ${module.author}`;
    }
    result += `\n   Builtin: ${module.builtin ? 'Yes' : 'No'}`;
    
    if (module.supportedGames && module.supportedGames.length > 0) {
      result += `\n   Supported Games: ${module.supportedGames.join(', ')}`;
    }
    
    if (detailed && module.version) {
      result += `\n   Version: ${module.version}`;
    }
    
    if (module.createdAt) {
      result += `\n   Created: ${new Date(module.createdAt).toLocaleDateString()}`;
    }
    if (module.updatedAt) {
      result += `\n   Updated: ${new Date(module.updatedAt).toLocaleDateString()}`;
    }
    
    if (detailed) {
      if (module.permissions && module.permissions.length > 0) {
        result += `\n   Required Permissions: ${module.permissions.join(', ')}`;
      }
      if (module.configSchema) {
        result += `\n   Configurable: Yes`;
      }
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a player entity
   */
  private formatPlayer(player: any, detailed: boolean = false): string {
    let result = player.name || 'Unknown Player';
    result += `\n   ID: ${player.id}`;
    
    if (player.steamId) {
      result += `\n   Steam ID: ${player.steamId}`;
    }
    if (player.epicOnlineServicesId) {
      result += `\n   Epic ID: ${player.epicOnlineServicesId}`;
    }
    
    result += `\n   Online: ${player.online ? 'Yes' : 'No'}`;
    
    if (player.ipAddress) {
      result += `\n   IP: ${player.ipAddress}`;
    }
    if (player.country) {
      result += `\n   Country: ${player.country}`;
    }
    
    if (detailed) {
      if (player.currency) {
        result += `\n   Currency: ${player.currency}`;
      }
      if (player.xp) {
        result += `\n   XP: ${player.xp}`;
      }
      if (player.playtime) {
        result += `\n   Playtime: ${player.playtime} minutes`;
      }
    }
    
    if (player.createdAt) {
      result += `\n   First Seen: ${new Date(player.createdAt).toLocaleDateString()}`;
    }
    if (player.lastSeen) {
      result += `\n   Last Seen: ${new Date(player.lastSeen).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a gameserver entity
   */
  private formatGameserver(server: any, detailed: boolean = false): string {
    let result = server.name || 'Unnamed Server';
    result += `\n   ID: ${server.id}`;
    
    if (server.type) {
      result += `\n   Type: ${server.type}`;
    }
    
    result += `\n   Status: ${server.reachable ? 'Online' : 'Offline'}`;
    
    if (server.players !== undefined) {
      result += `\n   Players: ${server.players}/${server.maxPlayers || '?'}`;
    }
    
    if (server.ip && server.port) {
      result += `\n   Address: ${server.ip}:${server.port}`;
    }
    
    if (detailed) {
      if (server.version) {
        result += `\n   Version: ${server.version}`;
      }
      if (server.map) {
        result += `\n   Current Map: ${server.map}`;
      }
      if (server.uptime) {
        result += `\n   Uptime: ${server.uptime} minutes`;
      }
    }
    
    if (server.createdAt) {
      result += `\n   Created: ${new Date(server.createdAt).toLocaleDateString()}`;
    }
    if (server.updatedAt) {
      result += `\n   Updated: ${new Date(server.updatedAt).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format an item entity
   */
  private formatItem(item: any, detailed: boolean = false): string {
    let result = item.name || 'Unnamed Item';
    result += `\n   ID: ${item.id}`;
    
    if (item.code) {
      result += `\n   Code: ${item.code}`;
    }
    if (item.description) {
      result += `\n   Description: ${item.description}`;
    }
    if (item.price !== undefined) {
      result += `\n   Price: ${item.price}`;
    }
    if (item.quality) {
      result += `\n   Quality: ${item.quality}`;
    }
    
    if (detailed) {
      if (item.amount !== undefined) {
        result += `\n   Amount: ${item.amount}`;
      }
      if (item.gameserverId) {
        result += `\n   Server ID: ${item.gameserverId}`;
      }
    }
    
    if (item.createdAt) {
      result += `\n   Created: ${new Date(item.createdAt).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a role entity
   */
  private formatRole(role: any, detailed: boolean = false): string {
    let result = role.name || 'Unnamed Role';
    result += `\n   ID: ${role.id}`;
    
    if (role.description) {
      result += `\n   Description: ${role.description}`;
    }
    
    result += `\n   System Role: ${role.system ? 'Yes' : 'No'}`;
    
    if (role.permissions && role.permissions.length > 0) {
      result += `\n   Permissions: ${role.permissions.length} assigned`;
      if (detailed) {
        result += `\n   - ${role.permissions.join('\n   - ')}`;
      }
    }
    
    if (role.createdAt) {
      result += `\n   Created: ${new Date(role.createdAt).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a hook entity
   */
  private formatHook(hook: any, detailed: boolean = false): string {
    let result = hook.name || 'Unnamed Hook';
    result += `\n   ID: ${hook.id}`;
    
    if (hook.eventType) {
      result += `\n   Event: ${hook.eventType}`;
    }
    
    result += `\n   Enabled: ${hook.enabled ? 'Yes' : 'No'}`;
    
    if (hook.endpoint) {
      result += `\n   Endpoint: ${hook.endpoint}`;
    }
    
    if (detailed && hook.retryPolicy) {
      result += `\n   Retries: ${hook.retryPolicy}`;
    }
    
    if (hook.lastTriggered) {
      result += `\n   Last Triggered: ${new Date(hook.lastTriggered).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a cron job entity
   */
  private formatCronJob(job: any, _detailed: boolean = false): string {
    let result = job.name || 'Unnamed Cron Job';
    result += `\n   ID: ${job.id}`;
    
    if (job.schedule) {
      result += `\n   Schedule: ${job.schedule}`;
    }
    
    result += `\n   Enabled: ${job.enabled ? 'Yes' : 'No'}`;
    
    if (job.function) {
      result += `\n   Function: ${job.function}`;
    }
    
    if (job.lastRun) {
      result += `\n   Last Run: ${new Date(job.lastRun).toLocaleDateString()}`;
    }
    if (job.nextRun) {
      result += `\n   Next Run: ${new Date(job.nextRun).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format an event entity
   */
  private formatEvent(event: any, detailed: boolean = false): string {
    let result = event.eventType || event.type || 'Unknown Event';
    result += `\n   ID: ${event.id}`;
    
    if (event.playerId) {
      result += `\n   Player ID: ${event.playerId}`;
    }
    if (event.gameserverId) {
      result += `\n   Server ID: ${event.gameserverId}`;
    }
    
    if (event.data && detailed) {
      result += `\n   Data: ${JSON.stringify(event.data, null, 2).replace(/\n/g, '\n   ')}`;
    }
    
    if (event.createdAt) {
      result += `\n   Timestamp: ${new Date(event.createdAt).toLocaleString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a function entity
   */
  private formatFunction(func: any, _detailed: boolean = false): string {
    let result = func.name || 'Unnamed Function';
    result += `\n   ID: ${func.id}`;
    
    if (func.description) {
      result += `\n   Description: ${func.description}`;
    }
    
    if (func.moduleId) {
      result += `\n   Module ID: ${func.moduleId}`;
    }
    
    if (_detailed && func.code) {
      result += `\n   Code Length: ${func.code.length} characters`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a variable entity
   */
  private formatVariable(variable: any, _detailed: boolean = false): string {
    let result = variable.name || variable.key || 'Unnamed Variable';
    result += `\n   ID: ${variable.id}`;
    
    if (variable.value !== undefined) {
      const valueStr = typeof variable.value === 'string' 
        ? variable.value 
        : JSON.stringify(variable.value);
      result += `\n   Value: ${valueStr}`;
    }
    
    if (variable.gameserverId) {
      result += `\n   Server ID: ${variable.gameserverId}`;
    }
    if (variable.playerId) {
      result += `\n   Player ID: ${variable.playerId}`;
    }
    if (variable.moduleId) {
      result += `\n   Module ID: ${variable.moduleId}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format a command entity
   */
  private formatCommand(command: any, detailed: boolean = false): string {
    let result = command.name || 'Unnamed Command';
    result += `\n   ID: ${command.id}`;
    
    if (command.trigger) {
      result += `\n   Trigger: ${command.trigger}`;
    }
    if (command.helpText) {
      result += `\n   Help: ${command.helpText}`;
    }
    
    if (command.moduleId) {
      result += `\n   Module ID: ${command.moduleId}`;
    }
    
    if (detailed && command.arguments) {
      result += `\n   Arguments: ${command.arguments.length}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Generic formatter for unknown entity types
   */
  private formatGeneric(entity: any, _detailed: boolean = false): string {
    let result = entity.name || entity.title || entity.label || 'Unnamed Entity';
    result += `\n   ID: ${entity.id}`;
    
    // Add common fields
    const commonFields = ['description', 'type', 'status', 'enabled', 'active'];
    for (const field of commonFields) {
      if (entity[field] !== undefined) {
        const value = typeof entity[field] === 'boolean' 
          ? (entity[field] ? 'Yes' : 'No')
          : entity[field];
        result += `\n   ${field.charAt(0).toUpperCase() + field.slice(1)}: ${value}`;
      }
    }
    
    // Add timestamps
    if (entity.createdAt) {
      result += `\n   Created: ${new Date(entity.createdAt).toLocaleDateString()}`;
    }
    if (entity.updatedAt) {
      result += `\n   Updated: ${new Date(entity.updatedAt).toLocaleDateString()}`;
    }
    
    result += '\n';
    return result;
  }
  
  /**
   * Format an error response
   */
  formatError(error: any): ToolResult {
    let errorMessage = 'An error occurred while processing your request.\n\n';
    
    if (error.response?.data?.errors) {
      // Takaro API error format
      const errors = error.response.data.errors;
      errorMessage += 'Errors:\n';
      errors.forEach((err: any) => {
        errorMessage += `- ${err.message || err.detail || err}\n`;
      });
    } else if (error.message) {
      errorMessage += `Error: ${error.message}`;
    } else {
      errorMessage += 'Unknown error occurred.';
    }
    
    return {
      content: [
        {
          type: 'text',
          text: errorMessage
        }
      ]
    };
  }
  
  /**
   * Format a success message
   */
  formatSuccess(message: string, details?: any): ToolResult {
    let text = message;
    
    if (details) {
      text += '\n\n';
      if (typeof details === 'string') {
        text += details;
      } else if (details.id) {
        text += `ID: ${details.id}`;
      } else {
        text += JSON.stringify(details, null, 2);
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text
        }
      ]
    };
  }
}

// Export singleton instance
export const responseFormatter = new ResponseFormatter();