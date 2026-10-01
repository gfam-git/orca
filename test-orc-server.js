#!/usr/bin/env node
// ORC server test script
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env, ORCA_SPEC_ENDPOINT: 'http://localhost:9377/openapi.json' };
const server = spawn('npx', ['ts-node', path.join(process.cwd(), 'src/index.ts')], {
  cwd: '/opt/data/profiles/geebo/workspace/orca',
  env: env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('OUT:', text);
});

server.stderr.on('data', (data) => {
  console.error('ERR:', data.toString());
});

// Send MCP initialize
const msg1 = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' }
  }
});

setTimeout(() => {
  server.stdin.write(msg1 + '\n');
  console.log('Sent: initialize');
  
  // Send initialized notification
  setTimeout(() => {
    const msg2 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialized'
    });
    server.stdin.write(msg2 + '\n');
    console.log('Sent: initialized');
    
    // Send tool list
    setTimeout(() => {
      const msg3 = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
      server.stdin.write(msg3 + '\n');
      console.log('Sent: tools/list');
      
      // Send tool call with --help
      setTimeout(() => {
        const msg4 = JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'command_line',
            arguments: { input: '--help' }
          }
        });
        server.stdin.write(msg4 + '\n');
        console.log('Sent: command_line --help');
        
        // Send resource help
        setTimeout(() => {
          const msg5 = JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
              name: 'command_line',
              arguments: { input: 'health get --help' }
            }
          });
          server.stdin.write(msg5 + '\n');
          console.log('Sent: health get --help');
          
          // Send default help
          setTimeout(() => {
            const msg6 = JSON.stringify({
              jsonrpc: '2.0',
              id: 5,
              method: 'tools/call',
              params: {
                name: 'command_line',
                arguments: { input: 'default get --help' }
              }
            });
            server.stdin.write(msg6 + '\n');
            console.log('Sent: default get --help');
            
            // Send metrics help
            setTimeout(() => {
              const msg7 = JSON.stringify({
                jsonrpc: '2.0',
                id: 6,
                method: 'tools/call',
                params: {
                  name: 'command_line',
                  arguments: { input: 'metrics get --help' }
                }
              });
              server.stdin.write(msg7 + '\n');
              console.log('Sent: metrics get --help');
              
              // Send pressure cleanup help
              setTimeout(() => {
                const msg8 = JSON.stringify({
                  jsonrpc: '2.0',
                  id: 7,
                  method: 'tools/call',
                  params: {
                    name: 'command_line',
                    arguments: { input: 'pressure cleanup --help' }
                  }
                });
                server.stdin.write(msg8 + '\n');
                console.log('Sent: pressure cleanup --help');
                
                // Send tabs post help
                setTimeout(() => {
                  const msg9 = JSON.stringify({
                    jsonrpc: '2.0',
                    id: 8,
                    method: 'tools/call',
                    params: {
                      name: 'command_line',
                      arguments: { input: 'tabs post --help' }
                    }
                  });
                  server.stdin.write(msg9 + '\n');
                  console.log('Sent: tabs post --help');
                  
                  // Send start post help
                  setTimeout(() => {
                    const msg10 = JSON.stringify({
                      jsonrpc: '2.0',
                      id: 9,
                      method: 'tools/call',
                      params: {
                        name: 'command_line',
                        arguments: { input: 'start post --help' }
                      }
                    });
                    server.stdin.write(msg10 + '\n');
                    console.log('Sent: start post --help');
                    
                    // Send stop post help
                    setTimeout(() => {
                      const msg11 = JSON.stringify({
                        jsonrpc: '2.0',
                        id: 10,
                        method: 'tools/call',
                        params: {
                          name: 'command_line',
                          arguments: { input: 'stop post --help' }
                        }
                      });
                      server.stdin.write(msg11 + '\n');
                      console.log('Sent: stop post --help');
                      
                      // Send navigate post help
                      setTimeout(() => {
                        const msg12 = JSON.stringify({
                          jsonrpc: '2.0',
                          id: 11,
                          method: 'tools/call',
                          params: {
                            name: 'command_line',
                            arguments: { input: 'navigate post --help' }
                          }
                        });
                        server.stdin.write(msg12 + '\n');
                        console.log('Sent: navigate post --help');
                        
                        // Send snapshot get help
                        setTimeout(() => {
                          const msg13 = JSON.stringify({
                            jsonrpc: '2.0',
                            id: 12,
                            method: 'tools/call',
                            params: {
                              name: 'command_line',
                              arguments: { input: 'snapshot get --help' }
                            }
                          });
                          server.stdin.write(msg13 + '\n');
                          console.log('Sent: snapshot get --help');
                          
                          // Send act post help
                          setTimeout(() => {
                            const msg14 = JSON.stringify({
                              jsonrpc: '2.0',
                              id: 13,
                              method: 'tools/call',
                              params: {
                                name: 'command_line',
                                arguments: { input: 'act post --help' }
                              }
                            });
                            server.stdin.write(msg14 + '\n');
                            console.log('Sent: act post --help');
                            
                            // Send sessions cookies help
                            setTimeout(() => {
                              const msg15 = JSON.stringify({
                                jsonrpc: '2.0',
                                id: 14,
                                method: 'tools/call',
                                params: {
                                  name: 'command_line',
                                  arguments: { input: 'sessions cookies --help' }
                                }
                              });
                              server.stdin.write(msg15 + '\n');
                              console.log('Sent: sessions cookies --help');
                              
                              // Send some actual commands
                              setTimeout(() => {
                                const msg16 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 15,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'health get' }
                                  }
                                });
                                server.stdin.write(msg16 + '\n');
                                console.log('Sent: health get');
                                
                                const msg17 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 16,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'default get' }
                                  }
                                });
                                server.stdin.write(msg17 + '\n');
                                console.log('Sent: default get');
                                
                                const msg18 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 17,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'metrics get' }
                                  }
                                });
                                server.stdin.write(msg18 + '\n');
                                console.log('Sent: metrics get');
                                
                                const msg19 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 18,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'pressure cleanup --dryRun true' }
                                  }
                                });
                                server.stdin.write(msg19 + '\n');
                                console.log('Sent: pressure cleanup --dryRun true');
                                
                                const msg20 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 19,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'tabs post --userId test --sessionKey test123' }
                                  }
                                });
                                server.stdin.write(msg20 + '\n');
                                console.log('Sent: tabs post --userId test --sessionKey test123');
                                
                                const msg21 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 20,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'start post' }
                                  }
                                });
                                server.stdin.write(msg21 + '\n');
                                console.log('Sent: start post');
                                
                                const msg22 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 21,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'stop post' }
                                  }
                                });
                                server.stdin.write(msg22 + '\n');
                                console.log('Sent: stop post');
                                
                                const msg23 = JSON.stringify({
                                  jsonrpc: '2.0',
                                  id: 22,
                                  method: 'tools/call',
                                  params: {
                                    name: 'command_line',
                                    arguments: { input: 'sessions cookies --userId test' }
                                  }
                                });
                                server.stdin.write(msg23 + '\n');
                                console.log('Sent: sessions cookies --userId test');
                                
                                // Wait a bit then exit
                                setTimeout(() => {
                                  server.stdin.end();
                                  console.log('Done - exiting');
                                  setTimeout(() => {
                                    process.exit(0);
                                  }, 1000);
                                }, 2000);
                              }, 2000);
                            }, 2000);
                          }, 2000);
                        }, 2000);
                      }, 2000);
                    }, 2000);
                  }, 2000);
                }, 2000);
              }, 2000);
            }, 2000);
          }, 2000);
        }, 2000);
      }, 2000);
    }, 2000);
  }, 2000);
}, 2000);

// Kill after timeout
setTimeout(() => {
  console.log('Timeout - killing server');
  server.kill();
  process.exit(1);
}, 120000);
