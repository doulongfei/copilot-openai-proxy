import {OpenAIChatCompletionRequest} from '../src/types'

// We need to test the CopilotService methods that don't require network calls
// Import the module to test isAgentRequest and buildHeaders logic
// Since copilotService is a singleton, we test its public methods

describe('CopilotService', () => {
    // We dynamically import to avoid triggering storage initialization issues in test
    let copilotService: any

    beforeAll(async () => {
        const mod = await import('../src/copilot')
        copilotService = mod.copilotService
    })

    describe('isAgentRequest', () => {
        it('should return false for basic user message', () => {
            const body: OpenAIChatCompletionRequest = {
                model: 'gpt-4o',
                messages: [{role: 'user', content: 'Hello'}],
            }
            expect(copilotService.isAgentRequest(body)).toBe(false)
        })

        it('should return false for system + user messages', () => {
            const body: OpenAIChatCompletionRequest = {
                model: 'gpt-4o',
                messages: [
                    {role: 'system', content: 'You are helpful'},
                    {role: 'user', content: 'Hello'},
                ],
            }
            expect(copilotService.isAgentRequest(body)).toBe(false)
        })

        it('should return true when tool role message is present', () => {
            const body: OpenAIChatCompletionRequest = {
                model: 'gpt-4o',
                messages: [
                    {role: 'user', content: 'What is the weather?'},
                    {
                        role: 'assistant',
                        content: null,
                        tool_calls: [{
                            id: 'call_1',
                            type: 'function',
                            function: {name: 'get_weather', arguments: '{"city":"Tokyo"}'}
                        }]
                    },
                    {role: 'tool', tool_call_id: 'call_1', content: 'Sunny, 25°C'},
                ],
            }
            expect(copilotService.isAgentRequest(body)).toBe(true)
        })

        it('should return true when assistant has tool_calls', () => {
            const body: OpenAIChatCompletionRequest = {
                model: 'gpt-4o',
                messages: [
                    {role: 'user', content: 'Search for X'},
                    {
                        role: 'assistant',
                        content: 'Searching...',
                        tool_calls: [{
                            id: 'call_2',
                            type: 'function',
                            function: {name: 'search', arguments: '{"q":"X"}'}
                        }]
                    },
                ],
            }
            expect(copilotService.isAgentRequest(body)).toBe(true)
        })

        it('should return false for assistant without tool_calls', () => {
            const body: OpenAIChatCompletionRequest = {
                model: 'gpt-4o',
                messages: [
                    {role: 'user', content: 'Hi'},
                    {role: 'assistant', content: 'Hello!'},
                    {role: 'user', content: 'How are you?'},
                ],
            }
            expect(copilotService.isAgentRequest(body)).toBe(false)
        })
    })

    describe('buildHeaders', () => {
        const fakeToken = 'fake-token-123'

        it('should include required Copilot headers', () => {
            const headers = copilotService.buildHeaders(fakeToken)

            expect(headers['Authorization']).toBe(`Bearer ${fakeToken}`)
            expect(headers['content-type']).toBe('application/json')
            expect(headers['copilot-integration-id']).toBe('vscode-chat')
            expect(headers['editor-version']).toMatch(/^vscode\//)
            expect(headers['editor-plugin-version']).toMatch(/^copilot-chat\//)
            expect(headers['user-agent']).toMatch(/^GitHubCopilotChat\//)
            expect(headers['openai-intent']).toBe('conversation-panel')
            expect(headers['x-github-api-version']).toBeDefined()
            expect(headers['x-request-id']).toBeDefined()
        })

        it('should include unique x-request-id per call', () => {
            const h1 = copilotService.buildHeaders(fakeToken)
            const h2 = copilotService.buildHeaders(fakeToken)

            expect(h1['x-request-id']).not.toBe(h2['x-request-id'])
        })

        it('should add vision header when vision=true', () => {
            const headers = copilotService.buildHeaders(fakeToken, {vision: true})
            expect(headers['copilot-vision-request']).toBe('true')
        })

        it('should not add vision header when vision=false', () => {
            const headers = copilotService.buildHeaders(fakeToken, {vision: false})
            expect(headers['copilot-vision-request']).toBeUndefined()
        })

        it('should add agent initiator header when isAgent=true', () => {
            const headers = copilotService.buildHeaders(fakeToken, {isAgent: true})
            expect(headers['x-initiator']).toBe('agent')
        })

        it('should not add agent header when isAgent=false', () => {
            const headers = copilotService.buildHeaders(fakeToken, {isAgent: false})
            expect(headers['x-initiator']).toBeUndefined()
        })

        it('should support both vision and agent flags', () => {
            const headers = copilotService.buildHeaders(fakeToken, {vision: true, isAgent: true})
            expect(headers['copilot-vision-request']).toBe('true')
            expect(headers['x-initiator']).toBe('agent')
        })
    })
})
